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
    const currentData = teacherDoc.data();
    const currentName = currentData?.name || "";
    const nameChanged = name.trim() !== currentName.trim();
    const now = new Date().toISOString();

    const updatedFields: Record<string, any> = {
      name: name.trim(),
      phone: phone.trim(),
      photoUrl: photoUrl || null,
      bio: bio || null,
      subjects,
      showOnPublicSite,
      updatedAt: now,
    };

    await adminDb.collection("teachers").doc(id).update(updatedFields);

    // Update display name in Firebase Auth and users doc
    try {
      await adminAuth.updateUser(id, { displayName: name.trim() });
      await adminDb.collection("users").doc(id).set({ name: name.trim(), updatedAt: now }, { merge: true });
    } catch {
      // Ignore if user auth update fails non-critically
    }

    // If teacher's name changed, propagate updated name to active academic year's classes, slots, and scheduled sessions
    if (nameChanged) {
      try {
        const { searchParams } = new URL(request.url);
        const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
        const activeYear = searchParams.get("yearId") || cookieYear || new Date().getFullYear().toString();

        const yearRef = adminDb.collection("years").doc(activeYear);

        // 1. Classes where teacher is lead or co-teacher
        const [singleClassesSnap, multiClassesSnap] = await Promise.all([
          yearRef.collection("classes").where("teacherId", "==", id).get(),
          yearRef.collection("classes").where("teacherIds", "array-contains", id).get(),
        ]);

        const classDocsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        singleClassesSnap.docs.forEach((doc) => classDocsMap.set(doc.id, doc));
        multiClassesSnap.docs.forEach((doc) => classDocsMap.set(doc.id, doc));

        if (classDocsMap.size > 0) {
          const batch = adminDb.batch();
          classDocsMap.forEach((doc) => {
            const cdata = doc.data();
            const updates: Record<string, any> = { updatedAt: now };

            if (cdata.teacherId === id) {
              updates.teacherName = name.trim();
            }

            if (Array.isArray(cdata.teachers)) {
              updates.teachers = cdata.teachers.map((t: any) =>
                t.teacherId === id ? { ...t, teacherName: name.trim() } : t
              );
            }

            batch.update(doc.ref, updates);
          });
          await batch.commit();
        }

        // 2. Timetable slots
        const [singleSlotsSnap, multiSlotsSnap] = await Promise.all([
          yearRef.collection("slots").where("teacherId", "==", id).get(),
          yearRef.collection("slots").where("teacherIds", "array-contains", id).get(),
        ]);

        const slotDocsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        singleSlotsSnap.docs.forEach((doc) => slotDocsMap.set(doc.id, doc));
        multiSlotsSnap.docs.forEach((doc) => slotDocsMap.set(doc.id, doc));

        if (slotDocsMap.size > 0) {
          const batch = adminDb.batch();
          slotDocsMap.forEach((doc) => {
            const sdata = doc.data();
            const updates: Record<string, any> = { updatedAt: now };

            if (sdata.teacherId === id) {
              updates.teacherName = name.trim();
            }

            if (Array.isArray(sdata.teachers)) {
              updates.teachers = sdata.teachers.map((t: any) =>
                t.teacherId === id ? { ...t, teacherName: name.trim() } : t
              );
            }

            batch.update(doc.ref, updates);
          });
          await batch.commit();
        }

        // 3. Future scheduled sessions
        const scheduledSessionsSnap = await yearRef
          .collection("sessions")
          .where("teacherId", "==", id)
          .where("status", "==", "scheduled")
          .get();

        if (!scheduledSessionsSnap.empty) {
          const batch = adminDb.batch();
          scheduledSessionsSnap.docs.forEach((doc) => {
            if (!doc.data().locked) {
              batch.update(doc.ref, { teacherName: name.trim() });
            }
          });
          await batch.commit();
        }
      } catch (propagateErr) {
        console.warn("Failed to propagate updated teacher name to active classes/slots:", propagateErr);
      }
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
    const [singleClassesSnap, multiClassesSnap] = await Promise.all([
      adminDb.collection("years").doc(activeYear).collection("classes").where("teacherId", "==", id).get(),
      adminDb.collection("years").doc(activeYear).collection("classes").where("teacherIds", "array-contains", id).get(),
    ]);

    const activeClassesMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    singleClassesSnap.docs.forEach((doc) => activeClassesMap.set(doc.id, doc));
    multiClassesSnap.docs.forEach((doc) => activeClassesMap.set(doc.id, doc));

    if (activeClassesMap.size > 0) {
      const batch = adminDb.batch();
      activeClassesMap.forEach((doc) => {
        const cdata = doc.data();
        const isMulti = Boolean(cdata.isMultiTeacher);
        const currentTeachers: any[] = Array.isArray(cdata.teachers) ? cdata.teachers : [];

        if (isMulti && currentTeachers.length > 0) {
          const remaining = currentTeachers.filter((t) => t.teacherId !== id);
          if (remaining.length === 0) {
            batch.update(doc.ref, {
              teacherId: "",
              teacherName: "Unassigned",
              isMultiTeacher: false,
              teachers: [],
              teacherIds: [],
              updatedAt: new Date().toISOString(),
            });
          } else if (remaining.length === 1) {
            const sole = remaining[0];
            batch.update(doc.ref, {
              teacherId: sole.teacherId,
              teacherName: sole.teacherName,
              isMultiTeacher: false,
              teachers: [{ ...sole, splitPercentage: 100, role: "primary" }],
              teacherIds: [sole.teacherId],
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Normalize splits across remaining teachers
            const totalRemaining = remaining.reduce((s, t) => s + (t.splitPercentage || 0), 0) || 100;
            const reallocated = remaining.map((t, idx) => ({
              ...t,
              splitPercentage: Math.round(((t.splitPercentage || 50) / totalRemaining) * 100),
              role: idx === 0 ? "primary" : "co_teacher",
            }));
            const sumSplit = reallocated.reduce((s, t) => s + t.splitPercentage, 0);
            if (sumSplit !== 100 && reallocated.length > 0) {
              reallocated[0].splitPercentage += (100 - sumSplit);
            }
            batch.update(doc.ref, {
              teacherId: reallocated[0].teacherId,
              teacherName: reallocated[0].teacherName,
              isMultiTeacher: true,
              teachers: reallocated,
              teacherIds: reallocated.map((t) => t.teacherId),
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          // Standard single teacher class
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Unassigned",
            isMultiTeacher: false,
            teachers: [],
            teacherIds: [],
            updatedAt: new Date().toISOString(),
          });
        }
      });
      await batch.commit();
    }

    // 2. Scoped slots unassignment: ONLY in active academic year
    const [singleSlotsSnap, multiSlotsSnap] = await Promise.all([
      adminDb.collection("years").doc(activeYear).collection("slots").where("teacherId", "==", id).get(),
      adminDb.collection("years").doc(activeYear).collection("slots").where("teacherIds", "array-contains", id).get(),
    ]);

    const activeSlotsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    singleSlotsSnap.docs.forEach((doc) => activeSlotsMap.set(doc.id, doc));
    multiSlotsSnap.docs.forEach((doc) => activeSlotsMap.set(doc.id, doc));

    if (activeSlotsMap.size > 0) {
      const batch = adminDb.batch();
      activeSlotsMap.forEach((doc) => {
        const sdata = doc.data();
        const currentTeachers: any[] = Array.isArray(sdata.teachers) ? sdata.teachers : [];

        if (currentTeachers.length > 0) {
          const remaining = currentTeachers.filter((t) => t.teacherId !== id);
          if (remaining.length === 0) {
            batch.update(doc.ref, {
              teacherId: "",
              teacherName: "Unassigned",
              isMultiTeacher: false,
              teachers: [],
              teacherIds: [],
              updatedAt: new Date().toISOString(),
            });
          } else if (remaining.length === 1) {
            const sole = remaining[0];
            batch.update(doc.ref, {
              teacherId: sole.teacherId,
              teacherName: sole.teacherName,
              isMultiTeacher: false,
              teachers: [{ ...sole, splitPercentage: 100, role: "primary" }],
              teacherIds: [sole.teacherId],
              updatedAt: new Date().toISOString(),
            });
          } else {
            const totalRemaining = remaining.reduce((s, t) => s + (t.splitPercentage || 0), 0) || 100;
            const reallocated = remaining.map((t, idx) => ({
              ...t,
              splitPercentage: Math.round(((t.splitPercentage || 50) / totalRemaining) * 100),
              role: idx === 0 ? "primary" : "co_teacher",
            }));
            const sumSplit = reallocated.reduce((s, t) => s + t.splitPercentage, 0);
            if (sumSplit !== 100 && reallocated.length > 0) {
              reallocated[0].splitPercentage += (100 - sumSplit);
            }
            batch.update(doc.ref, {
              teacherId: reallocated[0].teacherId,
              teacherName: reallocated[0].teacherName,
              isMultiTeacher: true,
              teachers: reallocated,
              teacherIds: reallocated.map((t) => t.teacherId),
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          batch.update(doc.ref, {
            teacherId: "",
            teacherName: "Unassigned",
            isMultiTeacher: false,
            teachers: [],
            teacherIds: [],
            updatedAt: new Date().toISOString(),
          });
        }
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
        const [pastClassesSingle, pastClassesMulti] = await Promise.all([
          yearDoc.ref.collection("classes").where("teacherId", "==", id).limit(1).get(),
          yearDoc.ref.collection("classes").where("teacherIds", "array-contains", id).limit(1).get(),
        ]);
        if (!pastClassesSingle.empty || !pastClassesMulti.empty) {
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
      unassignedClasses: activeClassesMap.size,
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
