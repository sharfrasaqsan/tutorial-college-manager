import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { AcademicGrade, AcademicSubject } from "@/types";

const INITIAL_GRADES: AcademicGrade[] = Array.from({ length: 13 }, (_, i) => ({
  id: `grade-${i + 1}`,
  name: `Grade ${i + 1}`,
  order: i + 1,
  hidden: false,
}));

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const docRef = adminDb.collection("settings").doc("academic");
    const docSnap = await docRef.get();

    let grades: AcademicGrade[] = [];
    let subjects: AcademicSubject[] = [];

    if (!docSnap.exists || !docSnap.data()?.grades) {
      // Seed default Grade 1 through Grade 13
      grades = INITIAL_GRADES;
      subjects = [];
      await docRef.set({ grades, subjects }, { merge: true });
    } else {
      const data = docSnap.data();
      grades = data?.grades || INITIAL_GRADES;
      subjects = data?.subjects || [];
    }

    return NextResponse.json({ grades, subjects });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load academic settings." },
      { status: 500 }
    );
  }
}

const AcademicActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("addGrade"),
    name: z.string().min(1, "Grade name is required"),
    order: z.number().optional(),
  }),
  z.object({
    action: z.literal("renameGrade"),
    id: z.string().min(1),
    name: z.string().min(1, "Grade name is required"),
  }),
  z.object({
    action: z.literal("toggleGradeHidden"),
    id: z.string().min(1),
    hidden: z.boolean(),
  }),
  z.object({
    action: z.literal("addSubject"),
    name: z.string().min(1, "Subject name is required"),
  }),
  z.object({
    action: z.literal("renameSubject"),
    id: z.string().min(1),
    name: z.string().min(1, "Subject name is required"),
  }),
  z.object({
    action: z.literal("toggleSubjectHidden"),
    id: z.string().min(1),
    hidden: z.boolean(),
  }),
]);

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = AcademicActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid academic action." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("settings").doc("academic");
    const docSnap = await docRef.get();
    const data = docSnap.data() || {};
    let grades: AcademicGrade[] = data.grades || [...INITIAL_GRADES];
    let subjects: AcademicSubject[] = data.subjects || [];

    const payload = parsed.data;

    switch (payload.action) {
      case "addGrade": {
        const newOrder = payload.order || grades.length + 1;
        const newGrade: AcademicGrade = {
          id: `grade-${Date.now()}`,
          name: payload.name.trim(),
          order: newOrder,
          hidden: false,
        };
        grades.push(newGrade);
        grades.sort((a, b) => a.order - b.order);
        break;
      }
      case "renameGrade": {
        grades = grades.map((g) =>
          g.id === payload.id ? { ...g, name: payload.name.trim() } : g
        );
        break;
      }
      case "toggleGradeHidden": {
        grades = grades.map((g) =>
          g.id === payload.id ? { ...g, hidden: payload.hidden } : g
        );
        break;
      }
      case "addSubject": {
        const newSubject: AcademicSubject = {
          id: `sub-${Date.now()}`,
          name: payload.name.trim(),
          hidden: false,
        };
        subjects.push(newSubject);
        subjects.sort((a, b) => a.name.localeCompare(b.name));
        break;
      }
      case "renameSubject": {
        subjects = subjects.map((s) =>
          s.id === payload.id ? { ...s, name: payload.name.trim() } : s
        );
        break;
      }
      case "toggleSubjectHidden": {
        subjects = subjects.map((s) =>
          s.id === payload.id ? { ...s, hidden: payload.hidden } : s
        );
        break;
      }
    }

    await docRef.set({ grades, subjects }, { merge: true });

    return NextResponse.json({ status: "ok", grades, subjects });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update academic settings." },
      { status: 500 }
    );
  }
}
