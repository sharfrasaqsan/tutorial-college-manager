import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { UpdateStudentSchema, protectStudentJoinedAt } from "@/lib/students";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import { findEffectiveTermsForMonth } from "@/lib/classes";
import { generateFeeDocId } from "@/lib/fees";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { Student, ClassTerms } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/students/[id]
 * Returns student profile, current classes in active year, and fee history placeholder.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const studentDoc = await adminDb.collection("students").doc(id).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const data = studentDoc.data()!;
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // Read roster grade for the year
    const rosterDoc = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("roster")
      .doc(id)
      .get();

    const gradeForYear = rosterDoc.exists
      ? rosterDoc.data()?.grade
      : data.gradesByYear?.[yearId] || "Not Enrolled";

    const student: Student & { grade: string } = {
      id: studentDoc.id,
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
      grade: gradeForYear,
      active: data.active !== false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // Find classes where student is enrolled in the active year
    const enrolledClasses: Array<{
      id: string;
      name: string;
      grade: string;
      subject: string;
      teacherName?: string;
    }> = [];

    const classesSnap = await adminDb.collection("years").doc(yearId).collection("classes").get();
    for (const classDoc of classesSnap.docs) {
      const enrolmentDoc = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .doc(classDoc.id)
        .collection("enrolments")
        .doc(id)
        .get();

      if (enrolmentDoc.exists) {
        const classData = classDoc.data();
        enrolledClasses.push({
          id: classDoc.id,
          name: classData.name || `${classData.grade} ${classData.subject}`,
          grade: classData.grade,
          subject: classData.subject,
          teacherName: classData.teacherName,
        });
      }
    }

    // Attach deduplicated enrolled subjects to student object
    student.enrolledSubjects = Array.from(
      new Set(enrolledClasses.map((c) => c.subject).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Fetch student's fee history for the active year
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("studentId", "==", id)
      .get();

    const feeHistory: any[] = [];
    feesSnap.forEach((doc) => {
      const f = doc.data();
      feeHistory.push({
        id: doc.id,
        ...f,
      });
    });

    feeHistory.sort((a, b) => (b.month || "").localeCompare(a.month || ""));

    return NextResponse.json({
      student,
      gradeForYear,
      yearId,
      enrolledClasses,
      feeHistory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch student details: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/owner/students/[id]
 * Updates a student profile.
 * STRICT ENFORCEMENT: joinedAt can NEVER be edited, even if supplied in the request body!
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const studentDoc = await adminDb.collection("students").doc(id).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    }

    const existingStudent = studentDoc.data() as Student;

    const body = await request.json();
    const parsed = UpdateStudentSchema.safeParse(body);

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

    // CRITICAL: Protect joinedAt against any modification attempt!
    const immutableJoinedAt = protectStudentJoinedAt(existingStudent, body);

    const now = new Date().toISOString();

    const updatedGradesByYear = {
      ...(existingStudent.gradesByYear || {}),
      [yearId]: grade,
    };

    const updatedStudentRecord: Record<string, any> = {
      name,
      school,
      address,
      guardianName,
      guardianPhone,
      studentPhone: studentPhone || null,
      joinedAt: immutableJoinedAt, // STRICTLY PRESERVED
      admissionFee: {
        amount: admissionFee.amount,
        status: admissionFee.status,
        method: admissionFee.method || null,
        paidDate: admissionFee.paidDate || null,
        receiptNo: admissionFee.receiptNo || null,
      },
      gradesByYear: updatedGradesByYear,
      updatedAt: now,
    };

    // 1. Update students collection
    await adminDb.collection("students").doc(id).update(updatedStudentRecord);

    // 2. Update year roster
    await adminDb
      .collection("years")
      .doc(yearId)
      .collection("roster")
      .doc(id)
      .set(
        {
          studentId: id,
          studentName: name,
          grade,
          updatedAt: now,
        },
        { merge: true }
      );

    // 3. Sync class enrolments if enrolledClassIds was explicitly provided
    if (Array.isArray(enrolledClassIds)) {
      const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
      const classesSnap = await adminDb.collection("years").doc(yearId).collection("classes").get();

      for (const classDoc of classesSnap.docs) {
        const classId = classDoc.id;
        const enrolmentRef = classDoc.ref.collection("enrolments").doc(id);
        const enrolmentDoc = await enrolmentRef.get();
        const shouldBeEnrolled = enrolledClassIds.includes(classId);

        if (shouldBeEnrolled && !enrolmentDoc.exists) {
          const classData = classDoc.data();
          await enrolmentRef.set({
            studentId: id,
            studentName: name,
            studentSchool: school || "",
            studentGrade: grade,
            joinedMonth: currentMonth,
            enrolledAt: now,
          });

          const totalSnap = await classDoc.ref.collection("enrolments").get();
          await classDoc.ref.update({
            enrolledStudentCount: totalSnap.size,
            updatedAt: now,
          });

          const termsHistory: ClassTerms[] =
            classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
          if (termsHistory.length > 0) {
            let terms: ClassTerms;
            try {
              terms = findEffectiveTermsForMonth(termsHistory, currentMonth);
            } catch {
              terms = termsHistory[0];
            }
            const feeDocId = generateFeeDocId(id, classId, currentMonth);
            const feeRef = adminDb.collection("years").doc(yearId).collection("fees").doc(feeDocId);
            const feeDoc = await feeRef.get();
            if (!feeDoc.exists) {
              await feeRef.set({
                id: feeDocId,
                yearId,
                classId,
                className: classData.name || `${classData.grade} ${classData.subject}`,
                grade: classData.grade,
                subject: classData.subject,
                teacherId: classData.teacherId,
                teacherName: classData.teacherName || "",
                studentId: id,
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

          if (classData.teacherId) {
            try {
              await recalculateClassSalary(yearId, classData.teacherId, classId, currentMonth);
            } catch (e) {}
          }
        } else if (!shouldBeEnrolled && enrolmentDoc.exists) {
          await enrolmentRef.delete();
          const totalSnap = await classDoc.ref.collection("enrolments").get();
          await classDoc.ref.update({
            enrolledStudentCount: totalSnap.size,
            updatedAt: now,
          });

          const feesSnap = await adminDb
            .collection("years")
            .doc(yearId)
            .collection("fees")
            .where("classId", "==", classId)
            .where("studentId", "==", id)
            .where("status", "==", "unpaid")
            .get();

          const batch = adminDb.batch();
          feesSnap.forEach((fDoc) => {
            const fData = fDoc.data();
            if (fData.month && fData.month > currentMonth) {
              batch.delete(fDoc.ref);
            }
          });
          await batch.commit();

          const cData = classDoc.data();
          if (cData?.teacherId) {
            try {
              await recalculateClassSalary(yearId, cData.teacherId, classId, currentMonth);
            } catch (e) {}
          }
        }
      }
    }

    return NextResponse.json({
      student: {
        ...existingStudent,
        ...updatedStudentRecord,
        id,
        grade,
      },
      message: "Student updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update student: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/students/[id]
 * Safely removes a student from the active academic year:
 * 1. Verifies owner authentication.
 * 2. Un-enrolls student from all classes in active year and updates class enrolled student counts.
 * 3. Removes student from the year roster.
 * 4. Cancels future unpaid fee records for later months.
 * 5. Checks if student has historical activity (paid fees or attendance):
 *    - If historical activity exists: safely archives student (active: false, deleted: true, deletedInYear: yearId)
 *      so financial records and past receipts remain 100% frozen.
 *    - If zero historical activity exists: completely deletes the student record.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const studentDoc = await adminDb.collection("students").doc(id).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const studentData = studentDoc.data()!;
    const studentName = studentData.name || id;

    // Resolve active academic year: from query param, session cookie, or default
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");

    // 1. Un-enroll from all classes in the active year
    const classesSnap = await adminDb.collection("years").doc(yearId).collection("classes").get();
    for (const classDoc of classesSnap.docs) {
      const enrolmentRef = classDoc.ref.collection("enrolments").doc(id);
      const enrolmentDoc = await enrolmentRef.get();
      if (enrolmentDoc.exists) {
        await enrolmentRef.delete();
        const remainingSnap = await classDoc.ref.collection("enrolments").get();
        await classDoc.ref.update({
          enrolledStudentCount: remainingSnap.size,
          updatedAt: new Date().toISOString(),
        });

        // Recalculate salary for this class if teacher assigned
        const cData = classDoc.data();
        if (cData?.teacherId) {
          try {
            await recalculateClassSalary(yearId, cData.teacherId, classDoc.id, currentMonth);
          } catch (e) {
            console.warn("Salary recalc error on student delete:", e);
          }
        }
      }
    }

    // 2. Remove from active year's roster
    await adminDb.collection("years").doc(yearId).collection("roster").doc(id).delete().catch(() => {});

    // 3. Check and clean fee records in active year
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("studentId", "==", id)
      .get();

    const batch = adminDb.batch();
    let hasPaidFees = false;

    feesSnap.forEach((doc) => {
      const f = doc.data();
      if (f.status === "paid") {
        hasPaidFees = true;
      } else if (f.status === "unpaid") {
        batch.delete(doc.ref);
      }
    });

    await batch.commit();

    // Check across other years for paid fees if not already found
    if (!hasPaidFees) {
      const yearsSnap = await adminDb.collection("years").get();
      for (const yDoc of yearsSnap.docs) {
        if (yDoc.id !== yearId) {
          const priorPaid = await yDoc.ref
            .collection("fees")
            .where("studentId", "==", id)
            .where("status", "==", "paid")
            .limit(1)
            .get();
          if (!priorPaid.empty) {
            hasPaidFees = true;
            break;
          }
        }
      }
    }

    // Also check if admission fee was paid
    if (studentData.admissionFee?.status === "paid") {
      hasPaidFees = true;
    }

    if (hasPaidFees) {
      // Historical safety: Archive student profile so financial and receipt records remain intact
      await adminDb.collection("students").doc(id).update({
        active: false,
        deleted: true,
        deletedInYear: yearId,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Zero payment or attendance history: completely purge
      await adminDb.collection("students").doc(id).delete();
    }

    return NextResponse.json({
      success: true,
      message: `Student ${studentName} was deleted successfully.`,
      archived: hasPaidFees,
      yearId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete student: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
