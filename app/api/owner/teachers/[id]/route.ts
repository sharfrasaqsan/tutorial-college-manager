import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UpdateTeacherSchema } from "@/lib/teachers";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
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
    invalidatePublicSiteDataCache();
    return NextResponse.json({ teacher: { id, ...updatedDoc.data() } });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update teacher: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/teachers/[id]
 * Safely removes a teacher scoped strictly to the current academic year:
 * 1. Verifies owner session & double-confirmation
 * 2. Scopes unassignment ONLY to the active academic year (years/{yearId}/classes)
 *    Does NOT touch other academic years (e.g. 2025)!
 * 3. Preserves past historical activity:
 *    - Held sessions, past attendance, past fees, and past salary invoices remain 100% frozen.
 *    - Only future scheduled sessions (status: "scheduled") in the active year are unassigned.
 * 4. Historical data preservation:
 *    - If the teacher has historical records (held sessions or classes in prior years),
 *      the teacher profile is safely archived (deletedInYear: yearId, active: false, showOnPublicSite: false)
 *      and their Firebase Auth account is permanently disabled and revoked.
 *    - If the teacher has zero historical activity across all years, they are completely purged.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const teacherDoc = await adminDb.collection("teachers").doc(id).get();
    if (!teacherDoc.exists) {
      return NextResponse.json({ error: "Teacher record not found." }, { status: 404 });
    }

    const teacherData = teacherDoc.data();
    const teacherName = teacherData?.name || id;

    // Double-confirmation safety check (requires typed teacher name or "DELETE")
    const body = await request.json().catch(() => ({}));
    const confirmText = (body?.confirmText || "").trim().toLowerCase();
    const cleanTeacherName = teacherName.trim().toLowerCase();

    if (confirmText !== "delete" && confirmText !== cleanTeacherName) {
      return NextResponse.json(
        {
          error: `Confirmation mismatch. Please type "${teacherName}" or "DELETE" to permanently delete this faculty member.`,
        },
        { status: 400 }
      );
    }

    // Resolve active academic year: from body, query param, or session cookie
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const bodyYear = body?.yearId;
    const activeYear = bodyYear || searchParams.get("yearId") || cookieYear || new Date().getFullYear().toString();

    // 1. Scoped unassignment: ONLY in active academic year (years/{activeYear}/classes)
    // Other academic years (e.g. 2025) are NEVER touched!
    const activeClassesSnap = await adminDb
      .collection("years")
      .doc(activeYear)
      .collection("classes")
      .where("teacherId", "==", id)
      .get();

    if (!activeClassesSnap.empty) {
      const batch = adminDb.batch();
      activeClassesSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          teacherId: "",
          teacherName: "Unassigned",
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }

    // 2. Scoped slots unassignment: ONLY in active academic year
    const activeSlotsSnap = await adminDb
      .collection("years")
      .doc(activeYear)
      .collection("slots")
      .where("teacherId", "==", id)
      .get();

    if (!activeSlotsSnap.empty) {
      const batch = adminDb.batch();
      activeSlotsSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          teacherId: "",
          teacherName: "Unassigned",
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }

    // 3. Unassign only future scheduled sessions in active year (held sessions remain 100% frozen)
    const futureSessionsSnap = await adminDb
      .collection("years")
      .doc(activeYear)
      .collection("sessions")
      .where("teacherId", "==", id)
      .where("status", "==", "scheduled")
      .get();

    if (!futureSessionsSnap.empty) {
      const batch = adminDb.batch();
      futureSessionsSnap.docs.forEach((doc) => {
        if (!doc.data().locked) {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Unassigned",
          });
        }
      });
      await batch.commit();
    }

    // 4. Check whether teacher has historical activity in prior years or past completed sessions
    const yearsSnap = await adminDb.collection("years").get();
    let hasPastActivity = false;

    for (const yearDoc of yearsSnap.docs) {
      if (yearDoc.id !== activeYear) {
        const pastClasses = await yearDoc.ref
          .collection("classes")
          .where("teacherId", "==", id)
          .limit(1)
          .get();
        if (!pastClasses.empty) {
          hasPastActivity = true;
          break;
        }
      }
    }

    if (!hasPastActivity) {
      const heldSessions = await adminDb
        .collection("years")
        .doc(activeYear)
        .collection("sessions")
        .where("teacherId", "==", id)
        .where("status", "==", "held")
        .limit(1)
        .get();
      if (!heldSessions.empty) {
        hasPastActivity = true;
      }
    }

    if (hasPastActivity) {
      // Teacher has historical records: archive for active year and disable login account
      // Past academic years and completed records remain completely intact!
      await adminDb.collection("teachers").doc(id).update({
        active: false,
        showOnPublicSite: false,
        deletedInYear: activeYear,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      try {
        await adminAuth.updateUser(id, { disabled: true });
        await adminAuth.revokeRefreshTokens(id);
      } catch (authErr: any) {
        console.warn(`Could not disable Auth account for ${id}:`, authErr?.message);
      }

      await adminDb.collection("users").doc(id).set({ active: false, disabled: true }, { merge: true });
    } else {
      // Teacher has zero historical activity in any year: clean purge
      await adminDb.collection("teachers").doc(id).delete();
      await adminDb.collection("users").doc(id).delete().catch(() => {});
      try {
        await adminAuth.deleteUser(id);
      } catch (authErr: any) {
        console.warn(`Auth user for ${id} not found or already deleted:`, authErr?.message);
      }
    }

    invalidatePublicSiteDataCache();

    return NextResponse.json({
      success: true,
      message: `Teacher ${teacherName} was removed from academic year ${activeYear}. Past records remain safely preserved.`,
      yearId: activeYear,
      unassignedClasses: activeClassesSnap.size,
      historicalPreserved: hasPastActivity,
    });
  } catch (error: any) {
    console.error("Failed to delete teacher:", error);
    return NextResponse.json(
      { error: "Failed to delete teacher: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
