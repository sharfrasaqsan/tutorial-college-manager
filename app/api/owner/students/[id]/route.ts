import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { UpdateStudentSchema, protectStudentJoinedAt } from "@/lib/students";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { Student } from "@/types";

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
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value || "2026";

    // Read roster grade for the year
    const rosterDoc = await adminDb
      .collection("years")
      .doc(cookieYear)
      .collection("roster")
      .doc(id)
      .get();

    const gradeForYear = rosterDoc.exists
      ? rosterDoc.data()?.grade
      : data.gradesByYear?.[cookieYear] || "Not Enrolled";

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

    const classesSnap = await adminDb.collection("years").doc(cookieYear).collection("classes").get();
    for (const classDoc of classesSnap.docs) {
      const enrolmentDoc = await adminDb
        .collection("years")
        .doc(cookieYear)
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

    // Fetch student's fee history for the active year
    const feesSnap = await adminDb
      .collection("years")
      .doc(cookieYear)
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
      yearId: cookieYear,
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
