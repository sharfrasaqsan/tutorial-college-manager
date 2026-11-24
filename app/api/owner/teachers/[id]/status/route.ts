import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ToggleTeacherStatusSchema } from "@/lib/teachers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/owner/teachers/[id]/status
 * Activates or deactivates a teacher:
 * - When deactivated:
 *   - active: false in Firestore
 *   - disabled: true in Firebase Auth (cannot log in)
 *   - hidden from public site
 *   - historical data preserved
 * - When reactivated:
 *   - active: true in Firestore
 *   - disabled: false in Firebase Auth (can log in)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const teacherDoc = await adminDb.collection("teachers").doc(id).get();
    if (!teacherDoc.exists) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = ToggleTeacherStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status payload." }, { status: 400 });
    }

    const { active } = parsed.data;
    const now = new Date().toISOString();

    // 1. Update Firestore record
    await adminDb.collection("teachers").doc(id).update({
      active,
      updatedAt: now,
    });

    // 2. Update Firebase Auth status to prevent/allow login
    try {
      await adminAuth.updateUser(id, {
        disabled: !active,
      });
    } catch (authErr: any) {
      console.warn("Could not update Firebase Auth user disabled status:", authErr.message);
    }

    return NextResponse.json({
      success: true,
      active,
      message: active ? "Teacher activated." : "Teacher deactivated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update teacher status: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
