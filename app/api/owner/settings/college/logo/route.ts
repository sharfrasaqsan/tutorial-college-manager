import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminStorage, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split(".").pop() || "png";
    const filename = `college/logo-${Date.now()}.${fileExt}`;

    let logoUrl = "";

    try {
      // Upload file to Firebase Admin Storage
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(filename);

      await fileRef.save(buffer, {
        contentType: file.type || "image/png",
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      // Attempt signed or public URL
      const [url] = await fileRef.getSignedUrl({
        action: "read",
        expires: "2099-12-31",
      });
      logoUrl = url;
    } catch {
      // In local dev without full cloud storage credentials, encode as data URL
      logoUrl = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
    }

    // Save logoUrl to settings/college
    await adminDb.collection("settings").doc("college").set(
      {
        logoUrl,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ status: "ok", logoUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to upload college logo." },
      { status: 500 }
    );
  }
}
