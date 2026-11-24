import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatLKR } from "@/lib/money";
import type { CollegeProfile, FeeRecord, Student } from "@/types";

interface RouteParams {
  params: Promise<{ receiptNo: string }>;
}

/**
 * GET /api/owner/fees/receipt/[receiptNo]
 * Fetches the printable receipt data for a given receipt number.
 * Looks up monthly fee records and student admission fee records.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { receiptNo } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // 1. Fetch college profile
    const collegeDoc = await adminDb.collection("settings").doc("college").get();
    const college = (collegeDoc.exists ? collegeDoc.data() : null) as CollegeProfile | null;

    const collegeInfo = {
      name: college?.name || "Tutorial College",
      logoUrl: college?.logoUrl || null,
      address: college?.address || "Colombo, Sri Lanka",
      phone: college?.phone || "",
      email: college?.email || "",
    };

    // 2. Search in monthly fee records across the year
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("receiptNo", "==", receiptNo)
      .limit(1)
      .get();

    if (!feesSnap.empty) {
      const feeDoc = feesSnap.docs[0];
      const feeData = feeDoc.data() as FeeRecord & {
        className?: string;
        grade?: string;
        subject?: string;
        teacherName?: string;
      };

      return NextResponse.json({
        receipt: {
          receiptNo,
          type: "tuition",
          date: feeData.paidAt || feeData.updatedAt || new Date().toISOString(),
          paymentMethod: feeData.paymentMethod || "cash",
          amount: feeData.amount,
          amountFormatted: formatLKR(feeData.amount),
          studentId: feeData.studentId,
          studentName: feeData.studentName || "Student",
          studentGrade: feeData.grade || "",
          className: feeData.className || "Class",
          teacherName: feeData.teacherName || "",
          month: feeData.month,
          description: `${feeData.className || "Class Fee"} - Monthly Tuition (${feeData.month})`,
          college: collegeInfo,
        },
      });
    }

    // 3. Search in student admission fee records
    const studentsSnap = await adminDb
      .collection("students")
      .where("admissionFee.receiptNo", "==", receiptNo)
      .limit(1)
      .get();

    if (!studentsSnap.empty) {
      const studentDoc = studentsSnap.docs[0];
      const studentData = studentDoc.data() as Student;
      const admFee = studentData.admissionFee;

      return NextResponse.json({
        receipt: {
          receiptNo,
          type: "admission",
          date: admFee.paidDate || studentData.updatedAt || new Date().toISOString(),
          paymentMethod: admFee.method || "cash",
          amount: admFee.amount,
          amountFormatted: formatLKR(admFee.amount),
          studentId: studentDoc.id,
          studentName: studentData.name,
          studentGrade: studentData.gradesByYear?.[yearId] || "Student",
          className: "Admission",
          description: "One-Time College Admission Fee",
          college: collegeInfo,
        },
      });
    }

    return NextResponse.json(
      { error: `Receipt "${receiptNo}" not found.` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("GET /api/owner/fees/receipt/[receiptNo] error:", error);
    return NextResponse.json(
      { error: "Failed to generate receipt: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
