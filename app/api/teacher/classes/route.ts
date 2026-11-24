import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";

/**
 * GET /api/teacher/classes
 * Lists all classes assigned to the authenticated teacher, with enrolled student contacts.
 *
 * CRITICAL VISIBILITY RULE:
 * Teachers see only their own classes and student contact details (name, school, guardian name, guardian phone).
 * Teachers NEVER see fees or payment records!
 */
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const teacherId = user!.uid;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = cookieYear || "2026";

    // 1. Fetch classes where teacherId == authenticatedTeacherId
    const classesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .where("teacherId", "==", teacherId)
      .get();

    const classesList: any[] = [];

    for (const classDoc of classesSnap.docs) {
      const classData = classDoc.data();

      // 2. Fetch enrolled students from enrolments subcollection
      const enrolmentsSnap = await classDoc.ref.collection("enrolments").get();
      const students: any[] = [];

      for (const enrolDoc of enrolmentsSnap.docs) {
        const enrolData = enrolDoc.data();
        const studentId = enrolData.studentId || enrolDoc.id;

        // Fetch student contact details
        const studentDoc = await adminDb.collection("students").doc(studentId).get();
        if (studentDoc.exists) {
          const s = studentDoc.data()!;
          students.push({
            id: studentId,
            name: s.name || enrolData.studentName || "Student",
            school: s.school || "",
            grade: s.gradesByYear?.[yearId] || classData.grade || "",
            guardianName: s.guardianName || "",
            guardianPhone: s.guardianPhone || "",
            joinedMonth: enrolData.joinedMonth || `${yearId}-01`,
          });
        } else {
          students.push({
            id: studentId,
            name: enrolData.studentName || "Student",
            school: enrolData.studentSchool || "",
            grade: enrolData.studentGrade || classData.grade || "",
            guardianName: enrolData.guardianName || "Guardian",
            guardianPhone: enrolData.guardianPhone || "",
            joinedMonth: enrolData.joinedMonth || `${yearId}-01`,
          });
        }
      }

      // Sort students by name
      students.sort((a, b) => a.name.localeCompare(b.name));

      // Build safe class record: NO FEES!
      classesList.push({
        id: classDoc.id,
        name: classData.name,
        grade: classData.grade,
        subject: classData.subject,
        active: classData.active !== false,
        studentCount: students.length,
        students,
      });
    }

    // Sort classes by name
    classesList.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ classes: classesList, teacherId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch teacher classes: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
