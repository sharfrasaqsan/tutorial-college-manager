import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UpdateTeacherSchema } from "@/lib/teachers";
import type { Teacher } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/teachers/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const doc = await adminDb.collection("teachers").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const data = doc.data()!;
    const teacher: Teacher = {
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
    };

    return NextResponse.json({ teacher });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch teacher: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/owner/teachers/[id]
 * Updates an existing teacher profile.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const teacherDoc = await adminDb.collection("teachers").doc(id).get();
    if (!teacherDoc.exists) {
      return NextResponse.json({ error: "Teacher record not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateTeacherSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid teacher data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { name, phone, photoUrl, bio, subjects, showOnPublicSite } = parsed.data;
    const now = new Date().toISOString();

    const updatedFields = {
      name,
      phone,
      photoUrl: photoUrl || null,
      bio: bio || null,
      subjects,
      showOnPublicSite,
      updatedAt: now,
    };

    await adminDb.collection("teachers").doc(id).update(updatedFields);

    // Update display name in Firebase Auth and users doc
    try {
      await adminAuth.updateUser(id, { displayName: name });
      await adminDb.collection("users").doc(id).set({ name, updatedAt: now }, { merge: true });
    } catch {
      // Ignore if user auth update fails non-critically
    }

    const updatedDoc = await adminDb.collection("teachers").doc(id).get();
    return NextResponse.json({ teacher: { id, ...updatedDoc.data() } });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update teacher: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
