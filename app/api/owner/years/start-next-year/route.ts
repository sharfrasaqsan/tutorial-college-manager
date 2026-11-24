import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { YEAR_COOKIE_NAME } from "../route";
import type { AcademicYear, AcademicGrade, YearRosterStudent } from "@/types";

const StartNextYearSchema = z.object({
  fromYear: z.string().regex(/^\d{4}$/, "Source year must be a 4-digit number"),
  toYear: z.string().regex(/^\d{4}$/, "Target year must be a 4-digit number"),
});

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = StartNextYearSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid academic years specified for promotion." },
        { status: 400 }
      );
    }

    const { fromYear, toYear } = parsed.data;

    // Rule: Next year must be exactly fromYear + 1
    if (parseInt(toYear, 10) !== parseInt(fromYear, 10) + 1) {
      return NextResponse.json(
        { error: `Target year (${toYear}) must follow source year (${fromYear}) directly.` },
        { status: 400 }
      );
    }

    const fromYearRef = adminDb.collection("years").doc(fromYear);
    const fromYearSnap = await fromYearRef.get();

    if (!fromYearSnap.exists) {
      return NextResponse.json(
        { error: `Source academic year ${fromYear} does not exist.` },
        { status: 404 }
      );
    }

    const fromYearData = fromYearSnap.data() as AcademicYear;

    // Rule: The action cannot run twice for the same year!
    if (fromYearData.promotedToYear) {
      return NextResponse.json(
        {
          error: `Promotion has already been executed for ${fromYear}. It cannot be run twice.`,
        },
        { status: 400 }
      );
    }

    const toYearRef = adminDb.collection("years").doc(toYear);
    const toYearSnap = await toYearRef.get();

    if (toYearSnap.exists) {
      return NextResponse.json(
        { error: `Academic year ${toYear} already exists. Cannot overwrite an existing year.` },
        { status: 400 }
      );
    }

    // Load Grades configuration to determine next grade advancement
    const academicSnap = await adminDb.collection("settings").doc("academic").get();
    const grades: AcademicGrade[] = academicSnap.data()?.grades || [];
    grades.sort((a, b) => a.order - b.order);

    // Read all student roster records for fromYear
    const rosterSnap = await fromYearRef.collection("roster").get();

    const batch = adminDb.batch();

    // 1. Create next year container
    const newYearData: AcademicYear = {
      id: toYear,
      name: toYear,
      status: "active",
      promotedFromYear: fromYear,
      createdAt: new Date().toISOString(),
    };
    batch.set(toYearRef, newYearData);

    let promotedCount = 0;
    let finishedCount = 0;

    rosterSnap.forEach((doc) => {
      const studentRoster = doc.data() as YearRosterStudent;
      const studentId = studentRoster.studentId || doc.id;
      const currentGradeName = studentRoster.grade;

      // Find current grade in order
      const currentGradeIdx = grades.findIndex(
        (g) => g.name.toLowerCase() === currentGradeName.toLowerCase()
      );

      // Check if student is in Grade 13 or highest grade
      const isGrade13OrHigher =
        currentGradeName.includes("13") ||
        (currentGradeIdx !== -1 && currentGradeIdx >= grades.length - 1);

      if (isGrade13OrHigher) {
        // Grade 13 students go to a Finished list for the owner to review
        finishedCount++;
        const finishedRosterItem: YearRosterStudent = {
          studentId,
          studentName: studentRoster.studentName || "",
          grade: `${currentGradeName} (Finished)`,
          status: "finished",
          promotedFromYear: fromYear,
          createdAt: new Date().toISOString(),
        };

        const targetDoc = toYearRef.collection("roster").doc(studentId);
        batch.set(targetDoc, finishedRosterItem);

        // Also add to finished collection for explicit review
        const finishedDoc = toYearRef.collection("finished").doc(studentId);
        batch.set(finishedDoc, {
          ...finishedRosterItem,
          graduatedFromYear: fromYear,
          reviewed: false,
        });
      } else {
        // Promote to next grade (grade order + 1)
        promotedCount++;
        const nextGrade =
          currentGradeIdx !== -1 && currentGradeIdx + 1 < grades.length
            ? grades[currentGradeIdx + 1].name
            : `Grade ${parseInt(currentGradeName.replace(/\D/g, "") || "1", 10) + 1}`;

        const promotedRosterItem: YearRosterStudent = {
          studentId,
          studentName: studentRoster.studentName || "",
          grade: nextGrade,
          status: "enrolled",
          promotedFromYear: fromYear,
          createdAt: new Date().toISOString(),
        };

        const targetDoc = toYearRef.collection("roster").doc(studentId);
        batch.set(targetDoc, promotedRosterItem);

        // Update permanent student document gradesByYear mapping
        // joinedAt is NEVER touched!
        const studentRef = adminDb.collection("students").doc(studentId);
        batch.set(
          studentRef,
          {
            gradesByYear: {
              [toYear]: nextGrade,
            },
          },
          { merge: true }
        );
      }
    });

    // 2. Lock fromYear so it cannot be run twice
    batch.update(fromYearRef, {
      promotedToYear: toYear,
    });

    // Commit batch
    await batch.commit();

    // 3. Switch selected year cookie to toYear
    const cookieStore = await cookies();
    cookieStore.set(YEAR_COOKIE_NAME, toYear, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return NextResponse.json({
      status: "ok",
      fromYear,
      toYear,
      promotedCount,
      finishedCount,
      totalProcessed: rosterSnap.size,
    });
  } catch (error: any) {
    console.error("Start next year error:", error);
    return NextResponse.json(
      { error: "Failed to execute academic year promotion." },
      { status: 500 }
    );
  }
}
