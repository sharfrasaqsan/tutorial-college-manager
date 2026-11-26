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

    const feesCollection = adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees");

    // 1. Fetch active classes and existing monthly fees in parallel
    const [classesSnap, existingFeesSnap] = await Promise.all([
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .where("active", "!=", false)
        .get(),
      feesCollection.where("month", "==", month).get(),
    ]);

    const classMetadataList: Array<{ id: string; name: string; grade: string; subject: string }> = [];
    const distinctGrades = new Set<string>();

    // Index all existing fee records in memory for O(1) existence checks without DB roundtrips
    const existingFeeDocIds = new Set<string>();
    const existingFeesMap = new Map<string, FeeRecord>();

    existingFeesSnap.docs.forEach((doc) => {
      existingFeeDocIds.add(doc.id);
      const data = doc.data();
      existingFeesMap.set(doc.id, {
        id: doc.id,
        yearId: data.yearId || yearId,
        classId: data.classId || "",
        studentId: data.studentId || "",
        studentName: data.studentName || "",
        month: data.month || month,
        amount: data.amount ?? 0,
        teacherShare: data.teacherShare ?? 0,
        status: data.status || "unpaid",
        paidAt: data.paidAt || data.paidDate || undefined,
        paymentMethod: data.paymentMethod || data.method || undefined,
        receiptNo: data.receiptNo,
        note: data.note || data.notes || undefined,
        className: data.className,
        grade: data.grade,
        subject: data.subject,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // 2. Fetch enrolments for all classes in parallel
    const enrolmentsSnapshots = await Promise.all(
      classesSnap.docs.map((classDoc) => classDoc.ref.collection("enrolments").get())
    );

    const batch = adminDb.batch();
    let batchWritesCount = 0;
    const now = new Date().toISOString();

    // 3. Evaluate enrolments and sync missing fee records in memory
    classesSnap.docs.forEach((classDoc, idx) => {
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

      const enrolmentsSnap = enrolmentsSnapshots[idx];
      if (enrolmentsSnap.empty) return;

      const termsHistory: ClassTerms[] =
        classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
      if (termsHistory.length === 0) return;

      let effectiveTerms: ClassTerms;
      try {
        effectiveTerms = findEffectiveTermsForMonth(termsHistory, month);
      } catch {
        effectiveTerms = classData.currentTerms || termsHistory[0];
      }

      for (const enrDoc of enrolmentsSnap.docs) {
        const enr = enrDoc.data();
        const studentId = enr.studentId || enrDoc.id;
        const joinedMonth = enr.joinedMonth || `${yearId}-01`;

        if (!shouldGenerateFeeForStudent(joinedMonth, month)) {
          continue;
        }

        const canonicalDocId = generateFeeDocId(studentId, classDoc.id, month);
        const legacyDocId = `${classDoc.id}_${studentId}_${month}`;

        const alreadyExists =
          existingFeeDocIds.has(canonicalDocId) || existingFeeDocIds.has(legacyDocId);

        if (!alreadyExists) {
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

          const newDocPayload = {
            ...newFeeRecord,
            className: classData.name || `${classData.grade} ${classData.subject}`,
            grade: classData.grade,
            subject: classData.subject,
            teacherId: classData.teacherId,
            teacherName: classData.teacherName || "",
            createdAt: now,
            updatedAt: now,
          };

          batch.set(feesCollection.doc(canonicalDocId), newDocPayload);
          existingFeeDocIds.add(canonicalDocId);
          existingFeesMap.set(canonicalDocId, newDocPayload);
          batchWritesCount++;
        }
      }
    });

    if (batchWritesCount > 0) {
      await batch.commit();
    }

    // 4. Use the in-memory map of fees
    const allMonthlyFees: FeeRecord[] = Array.from(existingFeesMap.values());

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

    // 6. Pagination support
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(0, parseInt(searchParams.get("limit") || "0", 10));
    const totalCount = filteredFees.length;

    let paginatedFees = filteredFees;
    if (limit > 0) {
      const startIndex = (page - 1) * limit;
      paginatedFees = filteredFees.slice(startIndex, startIndex + limit);
    }

    return NextResponse.json({
      fees: paginatedFees,
      totalCount,
      page: limit > 0 ? page : 1,
      totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1,
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
