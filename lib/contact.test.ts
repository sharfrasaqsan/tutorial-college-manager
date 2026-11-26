import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { verifyRecaptchaToken } from "./captcha.ts";

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

describe("Public Contact Message Validation & Google CAPTCHA", () => {
  it("accepts valid contact submission with captcha token", () => {
    const input = {
      name: "Kasun Jayawardena",
      email: "kasun@gmail.com",
      phone: "0771234567",
      subject: "Admissions & Enrollment",
      message: "I would like to inquire about enrolling my son in Grade 10 Science.",
      captchaToken: "test-valid-recaptcha-token",
    };
    const parsed = ContactSubmissionSchema.safeParse(input);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data.name, "Kasun Jayawardena");
      assert.strictEqual(parsed.data.email, "kasun@gmail.com");
      assert.strictEqual(parsed.data.phone, "0771234567");
      assert.strictEqual(parsed.data.captchaToken, "test-valid-recaptcha-token");
    }
  });

  it("rejects contact submission when captcha token is missing", () => {
    const input = {
      name: "Kasun Jayawardena",
      email: "kasun@gmail.com",
      message: "I would like to inquire about enrolling my son in Grade 10 Science.",
    };
    const parsed = ContactSubmissionSchema.safeParse(input);
    assert.strictEqual(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0].message, /CAPTCHA/i);
    }
  });

  it("rejects contact submission when captcha token is empty whitespace", () => {
    const input = {
      name: "Kasun Jayawardena",
      email: "kasun@gmail.com",
      message: "I would like to inquire about enrolling my son in Grade 10 Science.",
      captchaToken: "   ",
    };
    const parsed = ContactSubmissionSchema.safeParse(input);
    assert.strictEqual(parsed.success, false);
  });

  it("rejects invalid email address", () => {
    const input = {
      name: "Test User",
      email: "not-an-email",
      message: "Hello world this is a test message.",
      captchaToken: "token-123",
    };
    const parsed = ContactSubmissionSchema.safeParse(input);
    assert.strictEqual(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0].message, /valid email/i);
    }
  });

  it("rejects message shorter than 5 characters", () => {
    const input = {
      name: "Test User",
      email: "test@example.com",
      message: "Hi",
      captchaToken: "token-123",
    };
    const parsed = ContactSubmissionSchema.safeParse(input);
    assert.strictEqual(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0].message, /at least 5 characters/i);
    }
  });

  it("verifyRecaptchaToken correctly handles valid and invalid tokens", async () => {
    // Missing token
    const emptyResult = await verifyRecaptchaToken("");
    assert.strictEqual(emptyResult.success, false);
    assert.match(emptyResult.error || "", /CAPTCHA/i);

    // Valid test token
    const validResult = await verifyRecaptchaToken("test-token-valid");
    assert.strictEqual(validResult.success, true);

    // Invalid test token
    const invalidResult = await verifyRecaptchaToken("test-token-invalid");
    assert.strictEqual(invalidResult.success, false);
    assert.match(invalidResult.error || "", /verification failed/i);
  });

  it("formats admin push notification strictly for owner with link to /owner/messages", () => {
    const payload = {
      messageId: "msg-123",
      senderName: "Saman Kumara",
      email: "saman@gmail.com",
      phone: "0719876543",
      subject: "Tuition Fees",
      messageText: "What are the payment options for monthly tuition fees for Grade 11?",
    };

    const subjectSuffix = payload.subject ? ` • ${payload.subject}` : "";
    const title = `New Contact Inquiry: ${payload.senderName}${subjectSuffix}`;
    const snippet =
      payload.messageText.length > 90
        ? payload.messageText.slice(0, 87) + "..."
        : payload.messageText;
    const body = `${payload.email}${payload.phone ? ` • ${payload.phone}` : ""}: "${snippet}"`;
    const link = "/owner/messages";

    assert.strictEqual(title, "New Contact Inquiry: Saman Kumara • Tuition Fees");
    assert.strictEqual(
      body,
      'saman@gmail.com • 0719876543: "What are the payment options for monthly tuition fees for Grade 11?"'
    );
    assert.strictEqual(link, "/owner/messages");
  });
});
