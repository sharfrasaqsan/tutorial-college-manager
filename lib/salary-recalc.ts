import { adminDb } from "./firebase-admin";
import { findEffectiveTermsForMonth } from "./classes";
import {
  getSalaryStatus,
  generateSalaryDocId,
  generateSalaryDisplayName,
  calculateSalaryAmount,
} from "./salary";
import { notify, getOwnerUserId } from "./notifications";
import type { ClassSalaryRecord, FeeRecord } from "@/types";

/**
 * Recalculates and persists a class salary record for a given teacher, class, and month:
 * `years/{yearId}/salaries/{teacherId}_{classId}_{YYYY-MM}`
 *
 * Rules:
 * - Held sessions = count of sessions with status 'held' and countsForMonth = that month.
 * - Required sessions = from class terms effective for that month (default 8).
 * - Amount = sum of teacherShare of that month's fee records for the class.
 * - Unpaid students do NOT reduce the salary amount.
 * - If already paid, keep status 'paid' and preserve payment metadata (depositDate, invoiceNo, etc).
 * - If not paid, status is 'ready' when heldSessions >= requiredSessions, otherwise 'onHold'.
 */
export async function recalculateClassSalary(
  yearId: string,
  teacherId: string,
  classId: string,
  month: string
): Promise<ClassSalaryRecord | null> {
  const classRef = adminDb.collection("years").doc(yearId).collection("classes").doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) return null;

  const classData = classDoc.data()!;
  let actualTeacherId = teacherId;
  let teacherName = classData.teacherName || "Teacher";
  let splitPercentage = 100;

  if (classData.isMultiTeacher && Array.isArray(classData.teachers) && classData.teachers.length > 0) {
    const match = classData.teachers.find((t: any) => t.teacherId === teacherId);
    if (match) {
      actualTeacherId = match.teacherId;
      teacherName = match.teacherName || teacherName;
      splitPercentage = typeof match.splitPercentage === "number" ? match.splitPercentage : Math.round(100 / classData.teachers.length);
    } else {
      const primary = classData.teachers.find((t: any) => t.role === "primary") || classData.teachers[0];
      actualTeacherId = primary.teacherId;
      teacherName = primary.teacherName || teacherName;
      splitPercentage = typeof primary.splitPercentage === "number" ? primary.splitPercentage : 100;
    }
  } else {
    actualTeacherId = classData.teacherId || teacherId;
  }

  const className = classData.name || `${classData.grade} ${classData.subject}`;
  const grade = classData.grade || "";
  const subject = classData.subject || "";

  // Determine required sessions from effective terms
  let requiredSessions = 8;
  const termsHistory: import("@/types").ClassTerms[] =
    classData.termsHistory || (classData.currentTerms ? [classData.currentTerms] : []);
  if (termsHistory.length > 0) {
    try {
      const eff = findEffectiveTermsForMonth<import("@/types").ClassTerms>(termsHistory, month);
      if (eff && typeof eff.requiredSessionsPerMonth === "number") {
        requiredSessions = eff.requiredSessionsPerMonth;
      }
    } catch {
      requiredSessions = classData.currentTerms?.requiredSessionsPerMonth || 8;
    }
  }

  // Count held sessions for this class and month
  const sessionsSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("sessions")
    .where("classId", "==", classId)
    .where("countsForMonth", "==", month)
    .where("status", "==", "held")
    .get();
  const heldSessions = sessionsSnap.size;

  // Query fees for this class and month
  const feesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("fees")
    .where("classId", "==", classId)
    .where("month", "==", month)
    .get();

  const studentCount = feesSnap.size;
  const feeRecords: Array<{ teacherShare: number }> = [];
  feesSnap.forEach((doc) => {
    const f = doc.data() as FeeRecord;
    feeRecords.push({ teacherShare: f.teacherShare || 0 });
  });
  const rawTotalTeacherShare = calculateSalaryAmount(feeRecords);
  const amount = Math.round((rawTotalTeacherShare * splitPercentage) / 100);

  // Check existing salary record
  const docId = generateSalaryDocId(actualTeacherId, classId, month);
  const salaryRef = adminDb.collection("years").doc(yearId).collection("salaries").doc(docId);
  const existingDoc = await salaryRef.get();
  const existing = existingDoc.exists ? (existingDoc.data() as ClassSalaryRecord) : null;

  const isPaid = existing?.isPaid === true || existing?.status === "paid";
  const status = isPaid ? "paid" : getSalaryStatus(heldSessions, requiredSessions, false);
  const displayName = classData.isMultiTeacher
    ? `${generateSalaryDisplayName(month, className)} (${teacherName} - ${splitPercentage}%)`
    : generateSalaryDisplayName(month, className);
  const now = new Date().toISOString();

  const record: ClassSalaryRecord = {
    id: docId,
    yearId,
    teacherId: actualTeacherId,
    teacherName,
    classId,
    className,
    grade,
    subject,
    month,
    displayName,
    studentCount,
    amount,
    requiredSessions,
    heldSessions,
    status,
    isPaid,
    ...(isPaid && existing
      ? {
          invoiceId: existing.invoiceId,
          invoiceNo: existing.invoiceNo,
          depositDate: existing.depositDate,
          paymentMethod: existing.paymentMethod,
          paidAt: existing.paidAt,
        }
      : {}),
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };

  await salaryRef.set(record, { merge: true });

  // If salary just flipped to 'ready', notify college owner
  if (status === "ready" && (!existing || existing.status !== "ready")) {
    try {
      const ownerId = await getOwnerUserId();
      if (ownerId) {
        await notify(
          ownerId,
          "Class Salary Ready to Pay",
          `${className} has completed ${heldSessions} sessions and is ready for ${month} salary payout.`,
          "/owner/salary"
        );
      }
    } catch (notifErr) {
      console.error("Salary ready owner notification error:", notifErr);
    }
  }

  return record;
}

/**
 * Recalculates all class salary records for all active classes in a given year and month.
 */
export async function syncAllSalariesForMonth(
  yearId: string,
  month: string
): Promise<ClassSalaryRecord[]> {
  const classesSnap = await adminDb.collection("years").doc(yearId).collection("classes").get();
  const promises: Promise<ClassSalaryRecord | null>[] = [];

  classesSnap.forEach((doc) => {
    const data = doc.data();
    if (data.isMultiTeacher && Array.isArray(data.teachers) && data.teachers.length > 0) {
      data.teachers.forEach((t: any) => {
        if (t.teacherId) {
          promises.push(recalculateClassSalary(yearId, t.teacherId, doc.id, month));
        }
      });
    } else if (data.teacherId) {
      promises.push(recalculateClassSalary(yearId, data.teacherId, doc.id, month));
    }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is ClassSalaryRecord => r !== null);
}
