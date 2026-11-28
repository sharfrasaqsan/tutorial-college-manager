import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { CreateTeacherSchema } from "@/lib/teachers";
import { createTeacherAccount } from "@/lib/auth";
import { sendTeacherWelcomeEmail } from "@/lib/email";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
import type { Teacher, TeacherAssignedClass } from "@/types";

/**
 * GET /api/owner/teachers
 * Returns all active teachers for the specified academic year along with their assigned classes.
 * Preserves historical teacher records for prior academic years.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const activeYear = searchParams.get("yearId") || cookieYear || new Date().getFullYear().toString();

    // 1. Fetch teachers snapshot
    const snapshot = await adminDb.collection("teachers").get();

    // 2. Query classes in the active academic year to map class assignments
    const classesMap: Record<string, TeacherAssignedClass[]> = {};
    try {
      const classesSnap = await adminDb
        .collection("years")
        .doc(activeYear)
        .collection("classes")
        .get();

      classesSnap.forEach((doc) => {
        const cdata = doc.data();
        const classInfo: TeacherAssignedClass = {
          id: doc.id,
          name: `${cdata.grade || ""} ${cdata.subject || ""}`.trim() || doc.id,
          grade: cdata.grade || "",
          subject: cdata.subject || "",
          isMultiTeacher: Boolean(cdata.isMultiTeacher),
        };

        // Lead / single teacher assignment
        if (cdata.teacherId) {
          if (!classesMap[cdata.teacherId]) classesMap[cdata.teacherId] = [];
          if (!classesMap[cdata.teacherId].some((ci) => ci.id === doc.id)) {
            classesMap[cdata.teacherId].push(classInfo);
          }
        }

        // Multi-teacher assignments
        if (Array.isArray(cdata.teachers)) {
          cdata.teachers.forEach((t: any) => {
            if (t.teacherId) {
              if (!classesMap[t.teacherId]) classesMap[t.teacherId] = [];
              if (!classesMap[t.teacherId].some((ci) => ci.id === doc.id)) {
                classesMap[t.teacherId].push(classInfo);
              }
            }
          });
        }
      });
    } catch (classErr) {
      console.warn("Could not fetch active year classes for teacher mapping:", classErr);
    }

    const teachers: Teacher[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // If teacher was deleted in a specific academic year, exclude them from that year and future years
      if (data.deleted === true) return;
      if (data.deletedInYear && activeYear && activeYear >= data.deletedInYear) {
        return;
      }

      const assigned = classesMap[doc.id] || [];

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
        deleted: data.deleted || false,
        deletedAt: data.deletedAt || undefined,
        deletedInYear: data.deletedInYear || undefined,
        assignedClasses: assigned,
        assignedClassesCount: assigned.length,
      });
    });

    // Sort by name
    teachers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ teachers, yearId: activeYear });
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

    const { name, email, phone, photoUrl, bio, subjects, showOnPublicSite, password } = parsed.data;

    // 1. Provision Firebase Auth user with role: 'teacher', login password, and setup link
    const authResult = await createTeacherAccount(email, name, password);

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

    // 3. Resolve College Name for personalized email & branding
    let collegeName = "Tutorial College";
    try {
      const collegeDoc = await adminDb.collection("settings").doc("college").get();
      if (collegeDoc.exists && collegeDoc.data()?.name) {
        collegeName = collegeDoc.data()!.name;
      }
    } catch {}

    // 4. Construct direct Portal login URL
    const host = request.headers.get("host") || "tutorial-college-manager.vercel.app";
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const loginUrl = `${proto}://${host}/login`;

    // 5. Send automated welcome email with credentials to teacher
    const emailDispatch = await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName: name,
      temporaryPassword: authResult.password,
      resetLink: authResult.resetLink,
      collegeName,
      loginUrl,
    });

    invalidatePublicSiteDataCache();

    return NextResponse.json(
      {
        teacher: { ...teacherData, photoUrl, bio } as Teacher,
        tempPassword: authResult.password,
        resetLink: authResult.resetLink,
        collegeName,
        loginUrl,
        emailDispatch: {
          delivered: emailDispatch.delivered,
          message: emailDispatch.message,
        },
        message: "Teacher account and login details created successfully.",
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
