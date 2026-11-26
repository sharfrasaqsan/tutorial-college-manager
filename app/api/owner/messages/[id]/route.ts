import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateStatusSchema = z.object({
  status: z.enum(["unread", "read", "replied"]),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status. Must be unread, read, or replied." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("contact_messages").doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Contact message not found." }, { status: 404 });
    }

    await docRef.update({
      status: parsed.data.status,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      id,
      status: parsed.data.status,
    });
  } catch (error: any) {
    console.error(`[Owner Messages] Failed to update message ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to update contact message status." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
  }

  try {
    const docRef = adminDb.collection("contact_messages").doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Contact message not found." }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      id,
      deleted: true,
    });
  } catch (error: any) {
    console.error(`[Owner Messages] Failed to delete message ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to delete contact message." },
      { status: 500 }
    );
  }
}
