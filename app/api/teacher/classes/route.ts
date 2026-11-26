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

    // 2. Fetch enrolled students for each class in parallel
    const classesList: any[] = await Promise.all(
      classesSnap.docs.map(async (classDoc) => {
        const classData = classDoc.data();
        const enrolmentsSnap = await classDoc.ref.collection("enrolments").get();

        const students = enrolmentsSnap.docs.map((enrolDoc) => {
          const enrolData = enrolDoc.data();
          const studentId = enrolData.studentId || enrolDoc.id;
          return {
            id: studentId,
            name: enrolData.studentName || "Student",
            school: enrolData.studentSchool || "",
            grade: enrolData.studentGrade || classData.grade || "",
            guardianName: enrolData.guardianName || "Guardian",
            guardianPhone: enrolData.guardianPhone || "",
            joinedMonth: enrolData.joinedMonth || `${yearId}-01`,
          };
        });

        // Sort students by name
        students.sort((a, b) => a.name.localeCompare(b.name));

        // Build safe class record: NO FEES!
        return {
          id: classDoc.id,
          name: classData.name,
          grade: classData.grade,
          subject: classData.subject,
          active: classData.active !== false,
          studentCount: students.length,
          students,
        };
      })
    );

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
