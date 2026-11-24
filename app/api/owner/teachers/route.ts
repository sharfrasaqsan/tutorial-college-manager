import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { CreateTeacherSchema } from "@/lib/teachers";
import { createTeacherAccount } from "@/lib/auth";
import type { Teacher } from "@/types";

/**
 * GET /api/owner/teachers
 * Returns all teachers ordered by creation date.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const snapshot = await adminDb.collection("teachers").get();
    const teachers: Teacher[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      teachers.push({
        id: doc.id,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        photoUrl: data.photoUrl || undefined,
        bio: data.bio || undefined,
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        showOnPublicSite: data.showOnPublicSite !== false,
        active: data.active !== false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || undefined,
      });
    });

    // Sort by name
    teachers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ teachers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch teachers: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/teachers
 * Creates a new teacher:
 * 1. Validates input
 * 2. Creates Firebase Auth user + custom claims + reset link via createTeacherAccount
 * 3. Saves complete teacher profile in Firestore
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = CreateTeacherSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid teacher data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { name, email, phone, photoUrl, bio, subjects, showOnPublicSite } = parsed.data;

    // 1. Provision Firebase Auth user with role: 'teacher' and generate setup link
    const authResult = await createTeacherAccount(email, name);

    // 2. Persist full teacher profile to Firestore
    const now = new Date().toISOString();
    const teacherData: Record<string, any> = {
      id: authResult.uid,
      name,
      email,
      phone,
      subjects,
      showOnPublicSite,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    if (photoUrl) teacherData.photoUrl = photoUrl;
    if (bio) teacherData.bio = bio;

    await adminDb.collection("teachers").doc(authResult.uid).set(teacherData, { merge: true });

    return NextResponse.json(
      {
        teacher: { ...teacherData, photoUrl, bio } as Teacher,
        resetLink: authResult.resetLink,
        message: "Teacher account created successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create teacher: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
