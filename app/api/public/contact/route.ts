import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { notifyAdminContactMessage } from "@/lib/notifications";
import { verifyRecaptchaToken } from "@/lib/captcha";
import type { ContactMessage } from "@/types";

const ContactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be 100 characters or fewer"),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(150, "Email address is too long"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .max(150, "Subject is too long")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters")
    .max(3000, "Message cannot exceed 3,000 characters"),
  captchaToken: z
    .string({ message: "Please complete the 'I'm not a robot' CAPTCHA verification." })
    .trim()
    .min(1, "Please complete the 'I'm not a robot' CAPTCHA verification."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ContactSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid contact form input." },
        { status: 400 }
      );
    }

    const { name, email, phone, subject, message, captchaToken } = parsed.data;

    // Verify Google reCAPTCHA
    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : undefined;
    const captchaResult = await verifyRecaptchaToken(captchaToken, clientIp);

    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || "CAPTCHA verification failed." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("contact_messages").doc();
    const messageId = docRef.id;
    const now = new Date().toISOString();

    const record: ContactMessage = {
      id: messageId,
      name,
      email,
      phone: phone || undefined,
      subject: subject || "General Inquiry",
      message,
      status: "unread",
      createdAt: now,
    };

    await docRef.set(record);

    // Dispatch in-app notification & FCM web push strictly to the administrator
    try {
      await notifyAdminContactMessage({
        messageId,
        senderName: name,
        email,
        phone: phone || undefined,
        subject: subject || "General Inquiry",
        messageText: message,
      });
    } catch (notifErr) {
      console.warn("[Contact] Failed to dispatch admin push notification:", notifErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been sent successfully. The administration desk will contact you soon.",
        messageId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Contact] Error handling contact form submission:", error);
    return NextResponse.json(
      { error: "Failed to send your message. Please try again or reach out via WhatsApp." },
      { status: 500 }
    );
  }
}
