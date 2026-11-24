import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { findEffectiveTermsForMonth } from "@/lib/classes";
import {
  MonthKeyRegex,
  generateFeeDocId,
  shouldGenerateFeeForStudent,
  calculateFeeSummary,
  filterFees,
} from "@/lib/fees";
import { formatColomboPattern } from "@/lib/dates";
import type { FeeRecord, ClassTerms } from "@/types";

/**
 * GET /api/owner/fees
 * Lists student fee records for the selected year and month:
 * - Automatically syncs/generates missing fee records for active classes & enrolled students
 * - Preserves any existing fee amounts (e.g. mid-month joiner reductions) and payment receipts
 * - Returns monthly financial summary and filtered fee list
 */
export async function GET(request: NextRequest) {
  const { errorResponse, user } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // Default month: Colombo current YYYY-MM
    const currentColombo = formatColomboPattern(new Date(), "yyyy-MM");
    const month = searchParams.get("month") || currentColombo;

    if (!MonthKeyRegex.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    const classFilter = searchParams.get("classId") || "all";
    const gradeFilter = searchParams.get("grade") || "all";
    const statusFilter = (searchParams.get("status") || "all") as "all" | "unpaid" | "paid";
    const search = searchParams.get("search") || "";

    // 1. Fetch active classes in this year
    const classesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .where("active", "!=", false)
      .get();

    const classMetadataList: Array<{ id: string; name: string; grade: string; subject: string }> = [];
    const distinctGrades = new Set<string>();

    const feesCollection = adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees");

    const batch = adminDb.batch();
    let batchWritesCount = 0;
    const now = new Date().toISOString();

    // 2. Iterate each class to check enrolments and sync missing fee records
    for (const classDoc of classesSnap.docs) {
      const classData = classDoc.data();
      classMetadataList.push({
        id: classDoc.id,
        name: classData.name || `${classData.grade} ${classData.subject}`,
        grade: classData.grade,
        subject: classData.subject,
      });
      if (classData.grade) {
        distinctGrades.add(classData.grade);
      }

      // Read enrolments
      const enrolmentsSnap = await classDoc.ref.collection("enrolments").get();
      if (enrolmentsSnap.empty) continue;

      // Class terms history
      const termsHistory: ClassTerms[] = classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
      if (termsHistory.length === 0) continue;

      // Find effective terms for target month
      let effectiveTerms: ClassTerms;
      try {
        effectiveTerms = findEffectiveTermsForMonth(termsHistory, month);
      } catch {
        effectiveTerms = classData.currentTerms || termsHistory[0];
      }

      // Check each enrolment
      for (const enrDoc of enrolmentsSnap.docs) {
        const enr = enrDoc.data();
        const studentId = enr.studentId || enrDoc.id;
        const joinedMonth = enr.joinedMonth || `${yearId}-01`;

        if (!shouldGenerateFeeForStudent(joinedMonth, month)) {
          continue;
        }

        const canonicalDocId = generateFeeDocId(studentId, classDoc.id, month);
        const legacyDocId = `${classDoc.id}_${studentId}_${month}`;

        let feeDocRef = feesCollection.doc(canonicalDocId);
        let existingDoc = await feeDocRef.get();
        if (!existingDoc.exists) {
          const legacyDoc = await feesCollection.doc(legacyDocId).get();
          if (legacyDoc.exists) {
            existingDoc = legacyDoc;
            feeDocRef = feesCollection.doc(legacyDocId);
          }
        }

        if (!existingDoc.exists) {
          const newFeeRecord: FeeRecord = {
            id: canonicalDocId,
            yearId,
            classId: classDoc.id,
            studentId,
            studentName: enr.studentName || "Student",
            month,
            amount: effectiveTerms.monthlyFee,
            teacherShare: effectiveTerms.teacherSharePerStudent,
            status: "unpaid",
          };

          batch.set(feeDocRef, {
            ...newFeeRecord,
            className: classData.name || `${classData.grade} ${classData.subject}`,
            grade: classData.grade,
            subject: classData.subject,
            teacherId: classData.teacherId,
            teacherName: classData.teacherName || "",
            createdAt: now,
            updatedAt: now,
          });

          batchWritesCount++;
          // Firestore batch max is 500
          if (batchWritesCount >= 450) {
            await batch.commit();
            batchWritesCount = 0;
          }
        }
      }
    }

    if (batchWritesCount > 0) {
      await batch.commit();
    }

    // 3. Query all fee records for this year and month
    const feesSnap = await feesCollection.where("month", "==", month).get();
    const allMonthlyFees: FeeRecord[] = [];

    feesSnap.forEach((doc) => {
      const data = doc.data();
      allMonthlyFees.push({
        id: doc.id,
        yearId: data.yearId || yearId,
        classId: data.classId || "",
        studentId: data.studentId || "",
        studentName: data.studentName || "",
        month: data.month || month,
        amount: Number(data.amount) || 0,
        teacherShare: Number(data.teacherShare) || 0,
        status: data.status || "unpaid",
        paymentMethod: data.paymentMethod || undefined,
        paidAt: data.paidAt || undefined,
        receiptNo: data.receiptNo || undefined,
        // UI helper properties
        ...(data.className && { className: data.className }),
        ...(data.grade && { grade: data.grade }),
        ...(data.subject && { subject: data.subject }),
        ...(data.teacherName && { teacherName: data.teacherName }),
      } as any);
    });

    // 4. Calculate month financial summary
    const summary = calculateFeeSummary(allMonthlyFees);

    // 5. Apply filters for presentation
    const filteredFees = filterFees(allMonthlyFees, {
      classId: classFilter,
      grade: gradeFilter,
      status: statusFilter,
      search,
    });

    // Sort by student name ascending
    filteredFees.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

    return NextResponse.json({
      fees: filteredFees,
      summary,
      month,
      yearId,
      classes: classMetadataList.sort((a, b) => a.name.localeCompare(b.name)),
      grades: Array.from(distinctGrades).sort(),
    });
  } catch (error: any) {
    console.error("GET /api/owner/fees error:", error);
    return NextResponse.json(
      { error: "Failed to load fee collections: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
