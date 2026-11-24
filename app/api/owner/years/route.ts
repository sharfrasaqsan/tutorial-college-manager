import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import type { AcademicYear } from "@/types";

export const YEAR_COOKIE_NAME = "tcm_year";

const YearCreateSchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be a 4-digit number (e.g. 2026)"),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const snapshot = await adminDb
      .collection("years")
      .orderBy("id", "desc")
      .get();

    const years: AcademicYear[] = [];
    snapshot.forEach((doc) => {
      years.push(doc.data() as AcademicYear);
    });

    const cookieStore = await cookies();
    let selectedYear = cookieStore.get(YEAR_COOKIE_NAME)?.value;

    if (!selectedYear && years.length > 0) {
      selectedYear = years[0].id;
      cookieStore.set(YEAR_COOKIE_NAME, selectedYear, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
      });
    }

    return NextResponse.json({
      years,
      selectedYear: selectedYear || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to retrieve academic years." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = YearCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid year format." },
        { status: 400 }
      );
    }

    const { year } = parsed.data;
    const yearDocRef = adminDb.collection("years").doc(year);
    const existing = await yearDocRef.get();

    if (existing.exists) {
      return NextResponse.json(
        { error: `Academic year ${year} already exists.` },
        { status: 400 }
      );
    }

    const newYear: AcademicYear = {
      id: year,
      name: year,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await yearDocRef.set(newYear);

    // Update active year cookie
    const cookieStore = await cookies();
    cookieStore.set(YEAR_COOKIE_NAME, year, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return NextResponse.json({
      status: "ok",
      year: newYear,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create academic year." },
      { status: 500 }
    );
  }
}
