import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { cookies } from "next/headers";
import { YEAR_COOKIE_NAME } from "../route";

const SelectYearSchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Academic year must be 4 digits"),
});

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = SelectYearSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid academic year" }, { status: 400 });
    }

    const { year } = parsed.data;
    const cookieStore = await cookies();
    cookieStore.set(YEAR_COOKIE_NAME, year, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return NextResponse.json({ status: "ok", selectedYear: year });
  } catch (error) {
    return NextResponse.json({ error: "Failed to set active academic year" }, { status: 500 });
  }
}
