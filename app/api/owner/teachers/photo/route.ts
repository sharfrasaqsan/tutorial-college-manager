import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase-admin";

/**
 * POST /api/owner/teachers/photo
 * Uploads a teacher photo to Firebase Storage.
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo file provided." }, { status: 400 });
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image file must be under 5MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `teachers/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(fileName);

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type || "image/jpeg",
      },
      public: true,
    });

    // Generate public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return NextResponse.json({ photoUrl: publicUrl });
  } catch (error: any) {
    // If Firebase Storage is not yet enabled or configured on GCP, provide a fallback data URL
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
        return NextResponse.json({ photoUrl: dataUrl });
      }
    } catch {}

    return NextResponse.json(
      { error: "Failed to upload photo: " + (error?.message || "Storage error") },
      { status: 500 }
    );
  }
}
