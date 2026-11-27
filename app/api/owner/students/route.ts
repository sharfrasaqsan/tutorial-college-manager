import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { CreateStudentSchema, filterStudents } from "@/lib/students";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import { findEffectiveTermsForMonth } from "@/lib/classes";
import { generateFeeDocId } from "@/lib/fees";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { Student, ClassTerms } from "@/types";

/**
 * GET /api/owner/students
 * Lists students for the specified (or cookie-selected) academic year,
 * supporting search and grade filter.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const search = searchParams.get("search") || "";
    const grade = searchParams.get("grade") || "";

    // 1. Fetch roster, permanent student records, and classes for this year in parallel
    const [rosterSnap, studentsSnap, classesSnap] = await Promise.all([
      adminDb.collection("years").doc(yearId).collection("roster").get(),
      adminDb.collection("students").get(),
      adminDb.collection("years").doc(yearId).collection("classes").get(),
    ]);

    // 2. Fetch enrolments for all classes in parallel
    const enrolmentsSnapshots = await Promise.all(
      classesSnap.docs.map((classDoc) => classDoc.ref.collection("enrolments").get())
    );

    // Map each student to their enrolled unique subjects (Set for automatic deduplication)
    const studentSubjectsMap = new Map<string, Set<string>>();
    classesSnap.docs.forEach((classDoc, idx) => {
      const classData = classDoc.data();
      const subject = (classData.subject || "").trim();
      if (!subject) return;

      const enrolmentsSnap = enrolmentsSnapshots[idx];
      enrolmentsSnap.forEach((enrolDoc) => {
        const studentId = enrolDoc.id;
        if (!studentSubjectsMap.has(studentId)) {
          studentSubjectsMap.set(studentId, new Set());
        }
        studentSubjectsMap.get(studentId)!.add(subject);
      });
    });

    const rosterMap = new Map<string, { grade: string; status: string }>();
    rosterSnap.forEach((doc) => {
      const data = doc.data();
      rosterMap.set(doc.id, {
        grade: data.grade || "",
        status: data.status || "enrolled",
      });
    });

    const allStudents: Array<Student & { grade: string }> = [];

    studentsSnap.forEach((doc) => {
      const data = doc.data();

      // If student was deleted, exclude them from active directory
      if (data.deleted === true) return;
      if (data.deletedInYear && yearId && yearId >= data.deletedInYear) return;
      if (data.active === false) return;

      const rosterEntry = rosterMap.get(doc.id);
      const studentGrade = rosterEntry?.grade || data.gradesByYear?.[yearId] || "Not Enrolled";
      const enrolledSubjects = Array.from(studentSubjectsMap.get(doc.id) || []);
      enrolledSubjects.sort((a, b) => a.localeCompare(b));

      allStudents.push({
        id: doc.id,
        name: data.name || "",
        school: data.school || "",
        address: data.address || "",
        guardianName: data.guardianName || "",
        guardianPhone: data.guardianPhone || "",
        studentPhone: data.studentPhone || undefined,
        joinedAt: data.joinedAt || data.createdAt || new Date().toISOString(),
        admissionFee: {
          amount: data.admissionFee?.amount ?? 0,
          status: data.admissionFee?.status ?? "unpaid",
          method: data.admissionFee?.method || undefined,
          paidDate: data.admissionFee?.paidDate || undefined,
          receiptNo: data.admissionFee?.receiptNo || undefined,
        },
        gradesByYear: data.gradesByYear || {},
        grade: studentGrade,
        enrolledSubjects,
        active: data.active !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // 3. Apply search and grade filter
    const filtered = filterStudents(allStudents, search, grade);

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Pagination support
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(0, parseInt(searchParams.get("limit") || "0", 10));
    const totalCount = filtered.length;

    let paginatedStudents = filtered;
    if (limit > 0) {
      const startIndex = (page - 1) * limit;
      paginatedStudents = filtered.slice(startIndex, startIndex + limit);
    }

    return NextResponse.json({
      students: paginatedStudents,
      totalCount,
      page: limit > 0 ? page : 1,
      totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1,
      yearId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to list students: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/students
 * Creates a permanent student record:
 * - joinedAt is set automatically on creation and is permanent
 * - admission fee defaults to unpaid for new students
 * - adds student to years/{year}/roster with selected grade
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = CreateStudentSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid student data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const {
      name,
      school,
      address,
      guardianName,
      guardianPhone,
      studentPhone,
      grade,
      yearId,
      admissionFee,
      enrolledClassIds,
    } = parsed.data;

    // 1. Permanent timestamp
    const now = new Date().toISOString();
    const newStudentRef = adminDb.collection("students").doc();
    const studentId = newStudentRef.id;

    const studentRecord: Record<string, any> = {
      id: studentId,
      name,
      school,
      address,
      guardianName,
      guardianPhone,
      joinedAt: now, // Permanent creation timestamp
      admissionFee: {
        amount: admissionFee.amount,
        status: admissionFee.status,
      },
      gradesByYear: {
        [yearId]: grade,
      },
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    if (studentPhone) studentRecord.studentPhone = studentPhone;
    if (admissionFee.method) studentRecord.admissionFee.method = admissionFee.method;
    if (admissionFee.paidDate) studentRecord.admissionFee.paidDate = admissionFee.paidDate;
    if (admissionFee.receiptNo) studentRecord.admissionFee.receiptNo = admissionFee.receiptNo;

    // 2. Save in students collection
    await newStudentRef.set(studentRecord);

    // 3. Add to years/{year}/roster/{studentId}
    await adminDb
      .collection("years")
      .doc(yearId)
      .collection("roster")
      .doc(studentId)
      .set({
        studentId,
        studentName: name,
        grade,
        status: "enrolled",
        createdAt: now,
      });

    // 4. Enroll student into selected classes if any
    let enrolledCount = 0;
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");

    if (enrolledClassIds && Array.isArray(enrolledClassIds) && enrolledClassIds.length > 0) {
      for (const classId of enrolledClassIds) {
        const classRef = adminDb
          .collection("years")
          .doc(yearId)
          .collection("classes")
          .doc(classId);

        const classDoc = await classRef.get();
        if (!classDoc.exists) continue;

        const classData = classDoc.data()!;

        // Add enrolment doc
        await classRef.collection("enrolments").doc(studentId).set({
          studentId,
          studentName: name,
          studentSchool: school || "",
          studentGrade: grade,
          joinedMonth: currentMonth,
          enrolledAt: now,
        });

        // Update class total enrolled count
        const totalSnap = await classRef.collection("enrolments").get();
        await classRef.update({
          enrolledStudentCount: totalSnap.size,
          updatedAt: now,
        });

        // Generate fee record for currentMonth if terms exist
        const termsHistory: ClassTerms[] =
          classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
        if (termsHistory.length > 0) {
          let terms: ClassTerms;
          try {
            terms = findEffectiveTermsForMonth(termsHistory, currentMonth);
          } catch {
            terms = termsHistory[0];
          }

          const feeDocId = generateFeeDocId(studentId, classId, currentMonth);
          const feeDocRef = adminDb.collection("years").doc(yearId).collection("fees").doc(feeDocId);
          const existingFee = await feeDocRef.get();

          if (!existingFee.exists) {
            await feeDocRef.set({
              id: feeDocId,
              yearId,
              classId,
              className: classData.name || `${classData.grade} ${classData.subject}`,
              grade: classData.grade,
              subject: classData.subject,
              teacherId: classData.teacherId,
              teacherName: classData.teacherName || "",
              studentId,
              studentName: name,
              month: currentMonth,
              amount: terms.monthlyFee,
              teacherShare: terms.teacherSharePerStudent,
              status: "unpaid",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Recalculate teacher salary for this class
        if (classData.teacherId) {
          try {
            await recalculateClassSalary(yearId, classData.teacherId, classId, currentMonth);
          } catch (salaryErr) {
            console.warn("Salary recalc error on student create enrolment:", salaryErr);
          }
        }

        enrolledCount++;
      }
    }

    const message =
      enrolledCount > 0
        ? `Student registered and enrolled in ${enrolledCount} class(es).`
        : "Student registered successfully.";

    return NextResponse.json(
      {
        student: { ...studentRecord, grade },
        enrolledCount,
        message,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create student: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
