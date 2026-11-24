import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { BatchEnrollSchema, findEffectiveTermsForMonth } from "@/lib/classes";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { generateFeeDocId } from "@/lib/fees";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { ClassEnrolment, ClassTerms, FeeRecord } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/classes/[id]/enrolments
 * Lists all students enrolled in the class.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const enrolmentsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id)
      .collection("enrolments")
      .get();

    const enrolments: ClassEnrolment[] = [];
    enrolmentsSnap.forEach((doc) => {
      const data = doc.data();
      enrolments.push({
        id: doc.id,
        studentId: data.studentId || doc.id,
        classId: id,
        yearId,
        studentName: data.studentName || "",
        studentSchool: data.studentSchool || "",
        studentGrade: data.studentGrade || "",
        joinedMonth: data.joinedMonth || `${yearId}-01`,
        enrolledAt: data.enrolledAt || new Date().toISOString(),
      });
    });

    enrolments.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

    return NextResponse.json({ enrolments, count: enrolments.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch enrolments: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/classes/[id]/enrolments
 * Batch enrolls selected students into the class:
 * - A student can be in several classes
 * - Records joinedMonth for each enrolment
 * - Increments enrolledStudentCount on class doc
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = BatchEnrollSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid enrolment data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { studentIds, joinedMonth } = parsed.data;
    const now = new Date().toISOString();
    const enrolmentsCollection = classRef.collection("enrolments");

    let newlyEnrolledCount = 0;

    for (const studentId of studentIds) {
      // Check if student doc exists
      const studentDoc = await adminDb.collection("students").doc(studentId).get();
      if (!studentDoc.exists) continue;

      const studentData = studentDoc.data()!;

      // Read student's grade for this academic year
      const rosterDoc = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("roster")
        .doc(studentId)
        .get();

      const studentGrade = rosterDoc.exists
        ? rosterDoc.data()?.grade
        : studentData.gradesByYear?.[yearId] || "Grade 10";

      const enrolmentDocRef = enrolmentsCollection.doc(studentId);
      const existingEnrolment = await enrolmentDocRef.get();

      if (!existingEnrolment.exists) {
        newlyEnrolledCount++;
      }

      await enrolmentDocRef.set({
        studentId,
        studentName: studentData.name,
        studentSchool: studentData.school || "",
        studentGrade,
        joinedMonth,
        enrolledAt: now,
      });

      // Idempotently generate fee record for enrolled student for joinedMonth
      const classData = classDoc.data()!;
      const termsHistory: ClassTerms[] = classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
      if (termsHistory.length > 0) {
        let terms: ClassTerms;
        try {
          terms = findEffectiveTermsForMonth(termsHistory, joinedMonth);
        } catch {
          terms = termsHistory[0];
        }

        const feeDocId = generateFeeDocId(studentId, id, joinedMonth);
        const feeDocRef = adminDb.collection("years").doc(yearId).collection("fees").doc(feeDocId);
        const existingFee = await feeDocRef.get();

        if (!existingFee.exists) {
          await feeDocRef.set({
            id: feeDocId,
            yearId,
            classId: id,
            className: classData.name || `${classData.grade} ${classData.subject}`,
            grade: classData.grade,
            subject: classData.subject,
            teacherId: classData.teacherId,
            teacherName: classData.teacherName || "",
            studentId,
            studentName: studentData.name,
            month: joinedMonth,
            amount: terms.monthlyFee,
            teacherShare: terms.teacherSharePerStudent,
            status: "unpaid",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Refresh total count
    const totalSnap = await enrolmentsCollection.get();
    const totalCount = totalSnap.size;

    await classRef.update({
      enrolledStudentCount: totalCount,
      updatedAt: now,
    });

    // Recalculate salary for this class and joinedMonth
    try {
      const cData = classDoc.data();
      if (cData?.teacherId) {
        await recalculateClassSalary(
          yearId,
          cData.teacherId,
          id,
          joinedMonth
        );
      }
    } catch (recalcErr) {
      console.error("Salary recalc error after batch enrolment:", recalcErr);
    }

    return NextResponse.json({
      success: true,
      enrolledCount: totalCount,
      addedCount: newlyEnrolledCount,
      message: `Enrolled ${newlyEnrolledCount} student(s) into class. Total enrolled: ${totalCount}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to enroll students: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
