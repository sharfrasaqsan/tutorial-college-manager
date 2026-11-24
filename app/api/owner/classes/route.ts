import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  CreateClassSchema,
  generateClassName,
  checkDuplicateClass,
  calculateOwnerShare,
  validateClassTerms,
} from "@/lib/classes";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { ClassItem } from "@/types";

/**
 * GET /api/owner/classes
 * Lists all classes for the active academic year with student counts.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .get();

    const classes: ClassItem[] = [];

    for (const doc of classesSnap.docs) {
      const data = doc.data();

      // Count enrolled students
      const enrolmentsSnap = await doc.ref.collection("enrolments").get();
      const studentCount = enrolmentsSnap.size;

      const monthlyFee = data.currentTerms?.monthlyFee ?? 0;
      const teacherShare = data.currentTerms?.teacherSharePerStudent ?? 0;

      classes.push({
        id: doc.id,
        yearId,
        grade: data.grade || "",
        subject: data.subject || "",
        teacherId: data.teacherId || "",
        teacherName: data.teacherName || "Unassigned",
        name: data.name || `${data.grade} ${data.subject}`,
        currentTerms: {
          monthlyFee,
          teacherSharePerStudent: teacherShare,
          ownerShare: calculateOwnerShare(monthlyFee, teacherShare),
          requiredSessionsPerMonth: data.currentTerms?.requiredSessionsPerMonth ?? 8,
          effectiveFromMonth: data.currentTerms?.effectiveFromMonth ?? `${yearId}-01`,
        },
        termsHistory: data.termsHistory || [],
        enrolledStudentCount: studentCount,
        active: data.active !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt,
      });
    }

    // Sort by name
    classes.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ classes, yearId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to list classes: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/classes
 * Creates a class:
 * 1. Checks duplicate grade + subject in the same year (refuses duplicates)
 * 2. Validates terms (refuses teacher share > monthly fee)
 * 3. Auto-generates class name (e.g. "Grade 10 Maths")
 * 4. Resolves teacher name
 * 5. Saves class and initial terms record
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = CreateClassSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid class data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { yearId, grade, subject, teacherId, terms } = parsed.data;

    // 1. Term validation
    const termValidation = validateClassTerms(terms.monthlyFee, terms.teacherSharePerStudent);
    if (!termValidation.valid) {
      return NextResponse.json({ error: termValidation.error }, { status: 400 });
    }

    // 2. Uniqueness check in current year
    const existingSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .get();

    const existingClasses = existingSnap.docs.map((d) => ({
      id: d.id,
      grade: d.data().grade as string,
      subject: d.data().subject as string,
    }));

    const dupCheck = checkDuplicateClass(existingClasses, grade, subject);
    if (dupCheck.isDuplicate) {
      return NextResponse.json({ error: dupCheck.error }, { status: 400 });
    }

    // 3. Resolve teacher name
    let teacherName = "Unassigned";
    const teacherDoc = await adminDb.collection("teachers").doc(teacherId).get();
    if (teacherDoc.exists) {
      teacherName = teacherDoc.data()?.name || "Teacher";
    }

    // 4. Generate name and timestamps
    const name = generateClassName(grade, subject);
    const now = new Date().toISOString();
    const ownerShare = calculateOwnerShare(terms.monthlyFee, terms.teacherSharePerStudent);

    const initialTerm = {
      monthlyFee: terms.monthlyFee,
      teacherSharePerStudent: terms.teacherSharePerStudent,
      ownerShare,
      requiredSessionsPerMonth: terms.requiredSessionsPerMonth,
      effectiveFromMonth: terms.effectiveFromMonth,
      createdAt: now,
    };

    const newClassRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc();

    const classData = {
      id: newClassRef.id,
      yearId,
      grade,
      subject,
      teacherId,
      teacherName,
      name,
      currentTerms: initialTerm,
      termsHistory: [initialTerm],
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await newClassRef.set(classData);

    // Also store in terms subcollection for permanent version tracking
    await newClassRef.collection("terms").add(initialTerm);

    return NextResponse.json(
      {
        classItem: {
          ...classData,
          enrolledStudentCount: 0,
        },
        message: "Class created successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create class: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
