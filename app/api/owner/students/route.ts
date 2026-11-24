import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { CreateStudentSchema, filterStudents } from "@/lib/students";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { Student } from "@/types";

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

    // 1. Fetch roster for the year to get enrolled student ids and grades
    const rosterSnap = await adminDb.collection("years").doc(yearId).collection("roster").get();
    const rosterMap = new Map<string, { grade: string; status: string }>();

    rosterSnap.forEach((doc) => {
      const data = doc.data();
      rosterMap.set(doc.id, {
        grade: data.grade || "",
        status: data.status || "enrolled",
      });
    });

    // 2. Fetch all permanent student records
    const studentsSnap = await adminDb.collection("students").get();
    const allStudents: Array<Student & { grade: string }> = [];

    studentsSnap.forEach((doc) => {
      const data = doc.data();
      const rosterEntry = rosterMap.get(doc.id);
      const studentGrade = rosterEntry?.grade || data.gradesByYear?.[yearId] || "Not Enrolled";

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
        active: data.active !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // 3. Apply search and grade filter
    const filtered = filterStudents(allStudents, search, grade);

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      students: filtered,
      totalCount: filtered.length,
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

    return NextResponse.json(
      {
        student: { ...studentRecord, grade },
        message: "Student registered successfully.",
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
