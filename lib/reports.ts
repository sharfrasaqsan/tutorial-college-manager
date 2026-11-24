import { adminDb } from "./firebase-admin.ts";
import { syncAllSalariesForMonth } from "./salary-recalc.ts";
import { formatColomboPattern, formatMonthDisplay } from "./dates.ts";
import type { ClassSalaryRecord, FeeRecord, Student, TeacherSalaryRecord } from "@/types";

export interface StudentPaymentItem {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  amount: number;
  paymentMethod: "cash" | "bank";
  receiptNo: string;
  paidAt: string;
}

export interface ClassPaymentsGroup {
  classId: string;
  className: string;
  grade: string;
  subject: string;
  teacherName: string;
  paidCount: number;
  totalAmount: number;
  payments: StudentPaymentItem[];
}

export interface StudentPaymentsReportData {
  yearId: string;
  month: string;
  monthDisplay: string;
  generatedAt: string;
  classes: ClassPaymentsGroup[];
  totalPaidCount: number;
  totalCollected: number;
}

export interface PendingFeeStudentItem {
  studentId: string;
  studentName: string;
  grade: string;
  school?: string;
  guardianName: string;
  guardianPhone: string;
  classesPending: Array<{
    classId: string;
    className: string;
    month: string;
    amount: number;
  }>;
  monthlyTuitionPending: number;
  admissionFeePending: number;
  totalPending: number;
}

export interface PendingFeesReportData {
  yearId: string;
  month: string;
  monthDisplay: string;
  generatedAt: string;
  students: PendingFeeStudentItem[];
  totalStudentsPending: number;
  totalTuitionUnpaid: number;
  totalAdmissionUnpaid: number;
  grandTotalPending: number;
}

export interface TeacherSalaryClassItem {
  classId: string;
  className: string;
  grade: string;
  subject: string;
  heldSessions: number;
  requiredSessions: number;
  studentCount: number;
  amount: number;
  status: "onHold" | "ready" | "paid";
  depositDate?: string;
  paymentMethod?: string;
  invoiceNo?: string;
}

export interface TeacherSalaryGroupReport {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  teacherEmail?: string;
  classes: TeacherSalaryClassItem[];
  totalAmount: number;
  readyAmount: number;
  paidAmount: number;
  onHoldAmount: number;
}

export interface TeacherSalaryReportData {
  yearId: string;
  month: string;
  monthDisplay: string;
  generatedAt: string;
  teachers: TeacherSalaryGroupReport[];
  totalTeachers: number;
  totalClasses: number;
  totalReadyAmount: number;
  totalPaidAmount: number;
  totalOnHoldAmount: number;
  grandTotalSalary: number;
}

export interface ClassPerformanceItem {
  classId: string;
  className: string;
  grade: string;
  subject: string;
  teacherName: string;
  studentCount: number;
  requiredSessions: number;
  heldSessions: number;
  completionRate: number;
  salaryStatus: "onHold" | "ready" | "paid";
  monthlyFee: number;
  teacherShare: number;
  totalFeesExpected: number;
  totalTeacherShare: number;
}

export interface MonthSummaryReportData {
  yearId: string;
  month: string;
  monthDisplay: string;
  generatedAt: string;
  financials: {
    totalExpected: number;
    totalCollected: number;
    totalUnpaid: number;
    collectionRate: number;
    totalTeacherShare: number;
    totalSalaryPaid: number;
    totalSalaryReady: number;
    totalSalaryOnHold: number;
    ownerShare: number; // collected fees minus teacher amounts for the same month
    netCashFlow: number; // collected fees minus actual salary deposits paid
  };
  classesPerformance: ClassPerformanceItem[];
}

/**
 * 1. STUDENT PAYMENTS REPORT
 * Per class and per student, amounts paid, method, totals.
 */
export async function getStudentPaymentsReport(
  yearId: string,
  month: string
): Promise<StudentPaymentsReportData> {
  const feesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("fees")
    .where("month", "==", month)
    .where("status", "==", "paid")
    .get();

  const groupsMap = new Map<string, ClassPaymentsGroup>();
  let totalPaidCount = 0;
  let totalCollected = 0;

  feesSnap.forEach((doc) => {
    const fee = doc.data() as FeeRecord;
    let group = groupsMap.get(fee.classId);
    if (!group) {
      group = {
        classId: fee.classId,
        className: fee.className || "Class",
        grade: fee.grade || "",
        subject: fee.subject || "",
        teacherName: fee.teacherName || "Teacher",
        paidCount: 0,
        totalAmount: 0,
        payments: [],
      };
      groupsMap.set(fee.classId, group);
    }

    const item: StudentPaymentItem = {
      id: doc.id,
      studentId: fee.studentId,
      studentName: fee.studentName || "Student",
      grade: fee.grade || "",
      amount: fee.amount || 0,
      paymentMethod: (fee.paymentMethod as "cash" | "bank") || "cash",
      receiptNo: fee.receiptNo || "N/A",
      paidAt: fee.paidAt || fee.updatedAt || new Date().toISOString(),
    };

    group.payments.push(item);
    group.paidCount++;
    group.totalAmount += item.amount;

    totalPaidCount++;
    totalCollected += item.amount;
  });

  const classes = Array.from(groupsMap.values()).map((g) => {
    g.payments.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return g;
  });
  classes.sort((a, b) => a.className.localeCompare(b.className));

  return {
    yearId,
    month,
    monthDisplay: formatMonthDisplay(month),
    generatedAt: formatColomboPattern(new Date(), "yyyy-MM-dd HH:mm:ss"),
    classes,
    totalPaidCount,
    totalCollected,
  };
}

/**
 * 2. PENDING FEES REPORT
 * Unpaid students and amounts, outstanding admission fees, guardian phone.
 */
export async function getPendingFeesReport(
  yearId: string,
  month: string
): Promise<PendingFeesReportData> {
  // Query unpaid monthly fees for the selected month
  const feesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("fees")
    .where("month", "==", month)
    .where("status", "==", "unpaid")
    .get();

  // Fetch all students for contact info & admission fees
  const studentsSnap = await adminDb.collection("students").get();
  const studentsMap = new Map<string, Student>();
  studentsSnap.forEach((doc) => {
    studentsMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
  });

  const studentItemsMap = new Map<string, PendingFeeStudentItem>();
  let totalTuitionUnpaid = 0;

  feesSnap.forEach((doc) => {
    const fee = doc.data() as FeeRecord;
    let item = studentItemsMap.get(fee.studentId);
    const student = studentsMap.get(fee.studentId);

    if (!item) {
      const admissionFeePending =
        student?.admissionFee?.status === "unpaid" ? student.admissionFee.amount || 0 : 0;

      item = {
        studentId: fee.studentId,
        studentName: fee.studentName || student?.name || "Student",
        grade: fee.grade || student?.gradesByYear?.[yearId] || "",
        school: student?.school || "",
        guardianName: student?.guardianName || "Guardian",
        guardianPhone: student?.guardianPhone || student?.studentPhone || "N/A",
        classesPending: [],
        monthlyTuitionPending: 0,
        admissionFeePending,
        totalPending: admissionFeePending,
      };
      studentItemsMap.set(fee.studentId, item);
    }

    item.classesPending.push({
      classId: fee.classId,
      className: fee.className || "Class",
      month: fee.month,
      amount: fee.amount || 0,
    });

    item.monthlyTuitionPending += fee.amount || 0;
    item.totalPending += fee.amount || 0;
    totalTuitionUnpaid += fee.amount || 0;
  });

  // Also include students who have only an unpaid admission fee
  studentsMap.forEach((student) => {
    if (student.admissionFee?.status === "unpaid" && !studentItemsMap.has(student.id)) {
      const admissionFeePending = student.admissionFee.amount || 0;
      studentItemsMap.set(student.id, {
        studentId: student.id,
        studentName: student.name,
        grade: student.gradesByYear?.[yearId] || "",
        school: student.school || "",
        guardianName: student.guardianName || "Guardian",
        guardianPhone: student.guardianPhone || student.studentPhone || "N/A",
        classesPending: [],
        monthlyTuitionPending: 0,
        admissionFeePending,
        totalPending: admissionFeePending,
      });
    }
  });

  const students = Array.from(studentItemsMap.values());
  students.sort((a, b) => b.totalPending - a.totalPending);

  const totalAdmissionUnpaid = students.reduce((sum, s) => sum + s.admissionFeePending, 0);
  const grandTotalPending = totalTuitionUnpaid + totalAdmissionUnpaid;

  return {
    yearId,
    month,
    monthDisplay: formatMonthDisplay(month),
    generatedAt: formatColomboPattern(new Date(), "yyyy-MM-dd HH:mm:ss"),
    students,
    totalStudentsPending: students.length,
    totalTuitionUnpaid,
    totalAdmissionUnpaid,
    grandTotalPending,
  };
}

/**
 * 3. TEACHER SALARY REPORT
 * Per teacher and class, sessions, amount, status, deposit dates, totals.
 */
export async function getTeacherSalaryReport(
  yearId: string,
  month: string
): Promise<TeacherSalaryReportData> {
  // Sync all salaries for accuracy
  await syncAllSalariesForMonth(yearId, month);

  const salariesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("salaries")
    .where("month", "==", month)
    .get();

  const teachersSnap = await adminDb.collection("teachers").get();
  const teachersMap = new Map<string, { name: string; email?: string; phone?: string }>();
  teachersSnap.forEach((doc) => {
    const data = doc.data();
    teachersMap.set(doc.id, {
      name: data.name || "Teacher",
      email: data.email,
      phone: data.phone,
    });
  });

  const groupsMap = new Map<string, TeacherSalaryGroupReport>();
  let totalReadyAmount = 0;
  let totalPaidAmount = 0;
  let totalOnHoldAmount = 0;
  let grandTotalSalary = 0;
  let totalClasses = 0;

  salariesSnap.forEach((doc) => {
    const sal = doc.data() as ClassSalaryRecord;
    let group = groupsMap.get(sal.teacherId);
    if (!group) {
      const meta = teachersMap.get(sal.teacherId);
      group = {
        teacherId: sal.teacherId,
        teacherName: meta?.name || sal.teacherName || "Teacher",
        teacherPhone: meta?.phone,
        teacherEmail: meta?.email,
        classes: [],
        totalAmount: 0,
        readyAmount: 0,
        paidAmount: 0,
        onHoldAmount: 0,
      };
      groupsMap.set(sal.teacherId, group);
    }

    const item: TeacherSalaryClassItem = {
      classId: sal.classId,
      className: sal.className,
      grade: sal.grade,
      subject: sal.subject,
      heldSessions: sal.heldSessions,
      requiredSessions: sal.requiredSessions,
      studentCount: sal.studentCount,
      amount: sal.amount,
      status: sal.status,
      depositDate: sal.depositDate,
      paymentMethod: sal.paymentMethod,
      invoiceNo: sal.invoiceNo,
    };

    group.classes.push(item);
    group.totalAmount += sal.amount;
    grandTotalSalary += sal.amount;
    totalClasses++;

    if (sal.status === "paid") {
      group.paidAmount += sal.amount;
      totalPaidAmount += sal.amount;
    } else if (sal.status === "ready") {
      group.readyAmount += sal.amount;
      totalReadyAmount += sal.amount;
    } else {
      group.onHoldAmount += sal.amount;
      totalOnHoldAmount += sal.amount;
    }
  });

  const teachers = Array.from(groupsMap.values()).map((g) => {
    g.classes.sort((a, b) => a.className.localeCompare(b.className));
    return g;
  });
  teachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  return {
    yearId,
    month,
    monthDisplay: formatMonthDisplay(month),
    generatedAt: formatColomboPattern(new Date(), "yyyy-MM-dd HH:mm:ss"),
    teachers,
    totalTeachers: teachers.length,
    totalClasses,
    totalReadyAmount,
    totalPaidAmount,
    totalOnHoldAmount,
    grandTotalSalary,
  };
}

/**
 * 4. MONTH SUMMARY REPORT
 * Collected, pending, teacher amounts payable and paid,
 * owner share (collected fees minus teacher amounts for the same month),
 * sessions held versus required per class.
 */
export async function getMonthSummaryReport(
  yearId: string,
  month: string
): Promise<MonthSummaryReportData> {
  // Sync salaries for accuracy
  await syncAllSalariesForMonth(yearId, month);

  // 1. Query all fee records for month
  const feesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("fees")
    .where("month", "==", month)
    .get();

  let totalExpected = 0;
  let totalCollected = 0;
  let totalUnpaid = 0;
  let totalTeacherShare = 0;

  feesSnap.forEach((doc) => {
    const f = doc.data() as FeeRecord;
    const amt = f.amount || 0;
    const share = f.teacherShare || 0;

    totalExpected += amt;
    totalTeacherShare += share;

    if (f.status === "paid") {
      totalCollected += amt;
    } else {
      totalUnpaid += amt;
    }
  });

  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // 2. Query all salary records for month
  const salariesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("salaries")
    .where("month", "==", month)
    .get();

  let totalSalaryPaid = 0;
  let totalSalaryReady = 0;
  let totalSalaryOnHold = 0;

  salariesSnap.forEach((doc) => {
    const s = doc.data() as ClassSalaryRecord;
    if (s.status === "paid") {
      totalSalaryPaid += s.amount || 0;
    } else if (s.status === "ready") {
      totalSalaryReady += s.amount || 0;
    } else {
      totalSalaryOnHold += s.amount || 0;
    }
  });

  // Owner share rule: collected fees minus teacher amounts for the same month
  const ownerShare = Math.max(0, totalCollected - totalTeacherShare);
  const netCashFlow = totalCollected - totalSalaryPaid;

  // 3. Class performance table: sessions held vs required per class
  const classesSnap = await adminDb
    .collection("years")
    .doc(yearId)
    .collection("classes")
    .get();

  const salariesByClassId = new Map<string, ClassSalaryRecord>();
  salariesSnap.forEach((doc) => {
    const s = doc.data() as ClassSalaryRecord;
    salariesByClassId.set(s.classId, s);
  });

  const classesPerformance: ClassPerformanceItem[] = [];

  classesSnap.forEach((doc) => {
    const cData = doc.data();
    const sal = salariesByClassId.get(doc.id);

    const heldSessions = sal?.heldSessions || 0;
    const requiredSessions = sal?.requiredSessions || cData.currentTerms?.requiredSessionsPerMonth || 8;
    const completionRate =
      requiredSessions > 0
        ? Math.min(100, Math.round((heldSessions / requiredSessions) * 100))
        : 0;

    const studentCount = sal?.studentCount || cData.enrolledStudentCount || 0;
    const monthlyFee = cData.currentTerms?.monthlyFee || 0;
    const teacherShare = cData.currentTerms?.teacherSharePerStudent || 0;

    classesPerformance.push({
      classId: doc.id,
      className: cData.name || `${cData.grade} ${cData.subject}`,
      grade: cData.grade || "",
      subject: cData.subject || "",
      teacherName: cData.teacherName || "Teacher",
      studentCount,
      requiredSessions,
      heldSessions,
      completionRate,
      salaryStatus: sal?.status || "onHold",
      monthlyFee,
      teacherShare,
      totalFeesExpected: studentCount * monthlyFee,
      totalTeacherShare: studentCount * teacherShare,
    });
  });

  classesPerformance.sort((a, b) => a.className.localeCompare(b.className));

  return {
    yearId,
    month,
    monthDisplay: formatMonthDisplay(month),
    generatedAt: formatColomboPattern(new Date(), "yyyy-MM-dd HH:mm:ss"),
    financials: {
      totalExpected,
      totalCollected,
      totalUnpaid,
      collectionRate,
      totalTeacherShare,
      totalSalaryPaid,
      totalSalaryReady,
      totalSalaryOnHold,
      ownerShare,
      netCashFlow,
    },
    classesPerformance,
  };
}
