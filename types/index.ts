export type UserRole = "owner" | "teacher";

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  teacherId?: string;
  displayName?: string;
}

export interface AcademicYear {
  id: string; // e.g. "2026"
  name: string;
  status: "active" | "archived";
  promotedToYear?: string;
  promotedFromYear?: string;
  createdAt: string;
}

export interface CollegeProfile {
  name: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  aboutText: string;
  openingHours: string;
  updatedAt: string;
}

export interface AcademicGrade {
  id: string;
  name: string; // e.g. "Grade 10"
  order: number; // 1 to 13
  hidden: boolean;
}

export interface AcademicSubject {
  id: string;
  name: string;
  hidden: boolean;
}

export interface YearRosterStudent {
  studentId: string;
  studentName?: string;
  grade: string;
  status: "enrolled" | "finished";
  promotedFromYear?: string;
  createdAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subjects?: string[];
  bio?: string;
  active: boolean;
  createdAt: string;
}

export type AdmissionFeeStatus = "unpaid" | "paid" | "notApplicable";

export interface Student {
  id: string;
  name: string;
  phone?: string;
  guardianPhone?: string;
  address?: string;
  joinedAt: string; // First creation date, permanent, never changes
  admissionFeeStatus: AdmissionFeeStatus;
  admissionFeePaidAt?: string;
  admissionFeeReceiptNo?: string;
  gradesByYear: Record<string, string>; // e.g. { "2026": "Grade 10" }
  active: boolean;
}

export interface ClassItem {
  id: string;
  yearId: string;
  grade: string;
  subject: string;
  teacherId: string;
  teacherName?: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface ClassTerms {
  id: string;
  classId: string;
  yearId: string;
  effectiveFromMonth: string;
  monthlyFee: number;
  teacherSharePerStudent: number;
  requiredSessionsPerMonth: number;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  className?: string;
  grade?: string;
  subject?: string;
  yearId: string;
  teacherId: string;
  teacherName?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export type SessionType = "regular" | "makeup";
export type SessionStatus = "scheduled" | "held" | "missed" | "notCompleted";

export interface Session {
  id: string;
  classId: string;
  className?: string;
  grade?: string;
  subject?: string;
  yearId: string;
  teacherId: string;
  teacherName?: string;
  slotId?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: SessionType;
  status: SessionStatus;
  countsForMonth: string;
  markedAt?: string;
  markedBy?: string;
  locked: boolean;
}

export type PaymentMethod = "cash" | "bank";
export type FeeStatus = "unpaid" | "paid";

export interface FeeRecord {
  id: string;
  yearId: string;
  classId: string;
  studentId: string;
  studentName?: string;
  month: string;
  amount: number;
  teacherShare: number;
  status: FeeStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  receiptNo?: string;
}

export type SalaryStatus = "onHold" | "ready" | "paid";

export interface SalaryClassSummary {
  classId: string;
  className: string;
  grade: string;
  subject: string;
  studentCount: number;
  sessionsHeld: number;
  sessionsRequired: number;
  amount: number;
}

export interface TeacherSalaryRecord {
  id: string;
  yearId: string;
  teacherId: string;
  teacherName?: string;
  month: string;
  totalAmount: number;
  status: SalaryStatus;
  classes: SalaryClassSummary[];
  depositDate?: string;
  invoiceNo?: string;
  paidAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  yearId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  totalAmount: number;
  classes: SalaryClassSummary[];
  status: "ready" | "paid";
  collegeName: string;
  collegeLogoUrl?: string;
  issuedAt: string;
  paidAt?: string;
  depositDate?: string;
}

export interface CorrectionRequest {
  id: string;
  sessionId: string;
  teacherId: string;
  requestedStatus: "held" | "missed";
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
}

export interface TimeInterval {
  id: string;
  label?: string;
  teacherId: string;
  teacherName?: string;
  classId: string;
  className?: string;
  grade: string;
  startTime: string;
  endTime: string;
  date?: string;
  weekday?: number;
}
