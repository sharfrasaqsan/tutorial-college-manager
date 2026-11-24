import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import { recalculateClassSalary } from "@/lib/salary-recalc";

interface RouteParams {
  params: Promise<{ id: string; studentId: string }>;
}

/**
 * DELETE /api/owner/classes/[id]/enrolments/[studentId]
 * Removes a student from a class.
 * Rule: Removing a student from a class removes ONLY unpaid records for later months.
 * Past records, current month records, and any paid records are strictly preserved.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id, studentId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const enrolmentRef = classRef.collection("enrolments").doc(studentId);
    const existing = await enrolmentRef.get();

    if (!existing.exists) {
      return NextResponse.json({ error: "Enrolment record not found." }, { status: 404 });
    }

    await enrolmentRef.delete();

    // Remove only unpaid fee records for later months
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("classId", "==", id)
      .where("studentId", "==", studentId)
      .where("status", "==", "unpaid")
      .get();

    let removedLaterFeesCount = 0;
    const batch = adminDb.batch();
    feesSnap.forEach((doc) => {
      const feeData = doc.data();
      if (feeData.month && feeData.month > currentMonth) {
        batch.delete(doc.ref);
        removedLaterFeesCount++;
      }
    });

    if (removedLaterFeesCount > 0) {
      await batch.commit();
    }

    // Update count on class
    const totalSnap = await classRef.collection("enrolments").get();
    await classRef.update({
      enrolledStudentCount: totalSnap.size,
      updatedAt: new Date().toISOString(),
    });

    // Recalculate salary for this class and currentMonth
    try {
      const cData = (await classRef.get()).data();
      if (cData?.teacherId) {
        await recalculateClassSalary(
          yearId,
          cData.teacherId,
          id,
          currentMonth
        );
      }
    } catch (recalcErr) {
      console.error("Salary recalc error after removing enrolment:", recalcErr);
    }

    return NextResponse.json({
      success: true,
      message: `Student removed from class. Removed ${removedLaterFeesCount} unpaid future fee record(s).`,
      remainingCount: totalSnap.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to remove enrolment: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

