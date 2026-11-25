import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { AcademicYear } from "@/types";

interface RouteParams {
  params: Promise<{ year: string }>;
}

const YearParamSchema = z
  .string()
  .regex(/^\d{4}$/, "Academic year must be a 4-digit number");

const UpdateYearSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Display name cannot be empty")
    .max(50, "Display name must be 50 characters or fewer")
    .optional(),
  status: z.enum(["active", "archived"]).optional(),
});

const DeleteYearSchema = z.object({
  confirmYear: z.string().trim(),
});

/**
 * PATCH /api/owner/years/[year]
 * Edit an academic year's display name or status (active / archived).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { year } = await params;
  if (!YearParamSchema.safeParse(year).success) {
    return NextResponse.json({ error: "Invalid academic year." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload." },
        { status: 400 }
      );
    }

    const { name, status } = parsed.data;
    if (name === undefined && status === undefined) {
      return NextResponse.json(
        { error: "Provide at least name or status to update." },
        { status: 400 }
      );
    }

    const yearRef = adminDb.collection("years").doc(year);
    const snap = await yearRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: `Academic year ${year} not found.` },
        { status: 404 }
      );
    }

    const updates: Partial<AcademicYear> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;

    await yearRef.update(updates);

    const updated: AcademicYear = {
      ...(snap.data() as AcademicYear),
      ...updates,
    };

    return NextResponse.json({
      status: "ok",
      year: updated,
    });
  } catch (error: any) {
    console.error("Failed to update academic year:", error);
    return NextResponse.json(
      { error: "Failed to update academic year." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/years/[year]
 * Permanently deletes an academic year and its nested year-scoped subcollections.
 * Requires confirmYear === year in request body and refuses deleting the last remaining year.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { year } = await params;
  if (!YearParamSchema.safeParse(year).success) {
    return NextResponse.json({ error: "Invalid academic year." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = DeleteYearSchema.safeParse(body);
    if (!parsed.success || parsed.data.confirmYear !== year) {
      return NextResponse.json(
        { error: `Confirmation mismatch. Type "${year}" to permanently delete this year.` },
        { status: 400 }
      );
    }

    const yearsSnap = await adminDb.collection("years").orderBy("id", "desc").get();
    const targetDoc = yearsSnap.docs.find((d) => d.id === year);

    if (!targetDoc) {
      return NextResponse.json(
        { error: `Academic year ${year} not found.` },
        { status: 404 }
      );
    }

    if (yearsSnap.size <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only remaining academic year." },
        { status: 400 }
      );
    }

    // Recursively delete the year document and all its nested subcollections
    await adminDb.recursiveDelete(adminDb.collection("years").doc(year));

    const remainingYears = yearsSnap.docs
      .filter((d) => d.id !== year)
      .map((d) => d.data() as AcademicYear);

    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const nextSelectedYear =
      cookieYear === year || !cookieYear
        ? remainingYears[0]?.id || "2026"
        : cookieYear;

    const response = NextResponse.json({
      status: "ok",
      deletedYear: year,
      nextSelectedYear,
      years: remainingYears,
    });

    if (cookieYear === year) {
      response.cookies.set(YEAR_COOKIE_NAME, nextSelectedYear, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error: any) {
    console.error("Failed to delete academic year:", error);
    return NextResponse.json(
      { error: "Failed to delete academic year." },
      { status: 500 }
    );
  }
}
