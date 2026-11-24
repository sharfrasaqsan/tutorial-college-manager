import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_PUBLIC_SETTINGS } from "@/lib/public-data";
import type { PublicSiteSettings } from "@/types";

const PublicSiteSchema = z.object({
  heroPromise: z.string().default(""),
  heroSubtext: z.string().optional().default(""),
  aboutText: z.string().optional().default(""),
  keyFacts: z.object({
    location: z.string().default(""),
    yearsRunning: z.string().default(""),
    gradesTaught: z.string().default(""),
  }),
  whatsappNumber: z.string().default(""),
  mapUrl: z.string().optional().default(""),
  admissionFeeNote: z.string().optional().default(""),
  sections: z.object({
    showHero: z.boolean().default(true),
    showKeyFacts: z.boolean().default(true),
    showClasses: z.boolean().default(true),
    showTeacherStrip: z.boolean().default(true),
    showContactBlock: z.boolean().default(true),
  }),
  teacherVisibility: z
    .record(z.string(), z.boolean())
    .optional(),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const [docSnap, teachersSnap] = await Promise.all([
      adminDb.collection("settings").doc("publicSite").get(),
      adminDb.collection("teachers").where("active", "==", true).get(),
    ]);

    const settings: PublicSiteSettings = docSnap.exists
      ? (docSnap.data() as PublicSiteSettings)
      : DEFAULT_PUBLIC_SETTINGS;

    const teachers = teachersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Teacher",
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        showOnPublicSite: Boolean(data.showOnPublicSite),
        photoUrl: data.photoUrl || null,
      };
    });

    return NextResponse.json({
      settings,
      teachers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load public site settings: " + (error?.message || error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = PublicSiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid public site data" },
        { status: 400 }
      );
    }

    const { teacherVisibility, ...siteData } = parsed.data;

    const updatePayload: PublicSiteSettings = {
      ...siteData,
      updatedAt: new Date().toISOString(),
    };

    // Save public site settings in Firestore
    await adminDb.collection("settings").doc("publicSite").set(updatePayload, { merge: true });

    // If teacher visibility map provided, update each teacher record
    if (teacherVisibility && Object.keys(teacherVisibility).length > 0) {
      const batch = adminDb.batch();
      for (const [teacherId, show] of Object.entries(teacherVisibility)) {
        const teacherRef = adminDb.collection("teachers").doc(teacherId);
        batch.update(teacherRef, {
          showOnPublicSite: Boolean(show),
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
    }

    return NextResponse.json({
      status: "ok",
      settings: updatePayload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update public site settings: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
