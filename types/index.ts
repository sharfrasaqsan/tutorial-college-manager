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

export interface KeyFacts {
  location: string;
  yearsRunning: string;
  gradesTaught: string;
}

export interface PublicSiteSections {
  showHero: boolean;
  showKeyFacts: boolean;
  showClasses: boolean;
  showTeacherStrip: boolean;
  showContactBlock: boolean;
}

export interface PublicSiteSettings {
  heroPromise: string;
  heroSubtext?: string;
  aboutText?: string;
  keyFacts: KeyFacts;
  whatsappNumber: string;
  mapUrl?: string;
  admissionFeeNote?: string;
  sections: PublicSiteSections;
  updatedAt?: string;
}

export interface PublicSafeTeacher {
  id: string;
  name: string;
  photoUrl?: string;
  bio?: string;
  subjects: string[];
}

export interface PublicSafeClass {
  id: string;
  grade: string;
  subject: string;
  teacherName: string;
  monthlyFee: number;
}

export interface PublicSafeSlot {
  id: string;
  classId: string;
  grade: string;
  subject: string;
  teacherName: string;
  weekday: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // "14:00"
  endTime: string; // "16:00"
}

export interface PublicSiteData {
  college: CollegeProfile & {
    heroPromise?: string;
    heroSubtext?: string;
    keyFacts?: KeyFacts;
    whatsappNumber?: string;
    mapUrl?: string;
    admissionFeeNote?: string;
    sections?: PublicSiteSections;
  };
  teachers: PublicSafeTeacher[];
  classes: PublicSafeClass[];
  slots: PublicSafeSlot[];
  activeYear: string;
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
  phone: string;
  photoUrl?: string;
  bio?: string;
  subjects: string[];
  showOnPublicSite: boolean;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type AdmissionFeeStatus = "unpaid" | "paid" | "notApplicable";
export type PaymentMethod = "cash" | "bank";

export interface StudentAdmissionFee {
  amount: number;
  status: AdmissionFeeStatus;
  method?: PaymentMethod;
  paidDate?: string;
  receiptNo?: string;
}

export interface Student {
  id: string;
  name: string;
  school: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  studentPhone?: string;
  joinedAt: string; // First creation date, permanent, never changes
  admissionFee: StudentAdmissionFee;
  // Legacy compatibility fields
  admissionFeeStatus?: AdmissionFeeStatus;
  admissionFeePaidAt?: string;
  admissionFeeReceiptNo?: string;
  gradesByYear: Record<string, string>; // e.g. { "2026": "Grade 10" }
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  updatedAt?: string;
  currentTerms?: ClassTerms;
  termsHistory?: ClassTerms[];
  enrolledStudentCount?: number;
}

export interface ClassTerms {
  id?: string;
  classId?: string;
  yearId?: string;
  effectiveFromMonth: string;
  monthlyFee: number;
  teacherSharePerStudent: number;
  requiredSessionsPerMonth: number;
  ownerShare?: number;
  createdAt?: string;
}

export interface ClassEnrolment {
  id?: string;
  studentId: string;
  classId?: string;
  yearId?: string;
  joinedMonth: string;
  enrolledAt: string;
  studentName?: string;
  studentSchool?: string;
  studentGrade?: string;
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
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  validFrom?: string; // "YYYY-MM-DD"
  validTo?: string; // "YYYY-MM-DD"
  createdAt?: string;
  updatedAt?: string;
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

export type FeeStatus = "unpaid" | "paid";

export interface FeeRecord {
  id: string;
  yearId: string;
  classId: string;
  studentId: string;
  studentName?: string;
  className?: string;
  grade?: string;
  subject?: string;
  teacherId?: string;
  teacherName?: string;
  month: string;
  amount: number;
  teacherShare: number;
  status: FeeStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  receiptNo?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SalaryStatus = "onHold" | "ready" | "paid";

export interface ClassSalaryRecord {
  id: string; // `${teacherId}_${classId}_${month}`
  yearId: string;
  teacherId: string;
  teacherName?: string;
  classId: string;
  className: string;
  grade: string;
  subject: string;
  month: string;
  displayName: string; // e.g. "2026 November, Grade 10 Maths"
  studentCount: number;
  amount: number;
  requiredSessions: number;
  heldSessions: number;
  status: SalaryStatus;
  isPaid?: boolean;
  depositDate?: string;
  paymentMethod?: string;
  invoiceId?: string;
  invoiceNo?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
  collegeAddress?: string;
  collegePhone?: string;
  issuedAt: string;
  paidAt?: string;
  depositDate?: string;
  paymentMethod?: string;
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

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  readAt?: string | null;
  createdAt: string;
}

export interface FCMTokenRecord {
  token: string;
  userId: string;
  device?: string;
  createdAt: string;
  updatedAt: string;
}

