import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  UpdateClassTermsSchema,
  calculateOwnerShare,
  validateClassTerms,
} from "@/lib/classes";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { ClassTerms } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/owner/classes/[id]/terms
 * Creates a new terms version effective from a chosen month:
 * - Does NOT overwrite earlier months
 * - Enforces teacher share <= monthly fee
 * - Adds to terms subcollection and updates termsHistory
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateClassTermsSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid terms data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { monthlyFee, teacherSharePerStudent, requiredSessionsPerMonth, effectiveFromMonth } =
      parsed.data;

    // Validate teacher share <= fee
    const termVal = validateClassTerms(monthlyFee, teacherSharePerStudent);
    if (!termVal.valid) {
      return NextResponse.json({ error: termVal.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ownerShare = calculateOwnerShare(monthlyFee, teacherSharePerStudent);

    const newTerm: ClassTerms = {
      effectiveFromMonth,
      monthlyFee,
      teacherSharePerStudent,
      ownerShare,
      requiredSessionsPerMonth,
      createdAt: now,
    };

    // 1. Save in terms subcollection
    const newTermRef = await classRef.collection("terms").add(newTerm);
    newTerm.id = newTermRef.id;

    // 2. Update termsHistory and currentTerms on class doc
    const classData = classDoc.data()!;
    const existingHistory: ClassTerms[] = classData.termsHistory || [];

    // Filter out if a term for the exact same effectiveFromMonth already exists (replaces it)
    const updatedHistory = existingHistory.filter(
      (t) => t.effectiveFromMonth !== effectiveFromMonth
    );
    updatedHistory.push(newTerm);

    // Sort by effectiveFromMonth ascending
    updatedHistory.sort((a, b) => a.effectiveFromMonth.localeCompare(b.effectiveFromMonth));

    // The current active terms is the latest in history
    const latestTerm = updatedHistory[updatedHistory.length - 1];

    await classRef.update({
      currentTerms: latestTerm,
      termsHistory: updatedHistory,
      updatedAt: now,
    });

    return NextResponse.json({
      term: newTerm,
      currentTerms: latestTerm,
      message: `Class terms updated successfully starting from ${effectiveFromMonth}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update class terms: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
