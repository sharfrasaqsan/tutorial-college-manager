import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
import type { CollegeProfile } from "@/types";

const CollegeProfileSchema = z.object({
  name: z.string().min(1, "College name is required"),
  logoUrl: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Valid email is required"),
  aboutText: z.string().optional().default(""),
  openingHours: z.string().optional().default(""),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const docSnap = await adminDb.collection("settings").doc("college").get();

    if (!docSnap.exists) {
      // Default initial profile
      const defaultProfile: CollegeProfile = {
        name: "Tutorial College",
        logoUrl: "",
        address: "Colombo, Sri Lanka",
        phone: "+94 11 234 5678",
        email: "info@college.lk",
        aboutText: "A premier tutorial college dedicated to academic excellence.",
        openingHours: "Mon - Sat: 08:00 AM - 06:00 PM, Sun: 08:00 AM - 01:00 PM",
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ profile: defaultProfile });
    }

    return NextResponse.json({ profile: docSnap.data() as CollegeProfile });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to retrieve college profile." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = CollegeProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid college profile data." },
        { status: 400 }
      );
    }

    const profileData: CollegeProfile = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("settings").doc("college").set(profileData, { merge: true });
    invalidatePublicSiteDataCache();

    return NextResponse.json({
      status: "ok",
      profile: profileData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update college profile." },
      { status: 500 }
    );
  }
}
