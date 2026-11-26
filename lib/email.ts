import * as crypto from "crypto";
import nodemailer from "nodemailer";
import { adminDb } from "./firebase-admin.ts";

export interface TeacherWelcomeEmailOptions {
  teacherEmail: string;
  teacherName: string;
  temporaryPassword?: string;
  resetLink?: string;
  collegeName?: string;
  loginUrl?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  delivered: boolean;
  message: string;
}

/**
 * Generates a secure, readable temporary password containing uppercase,
 * lowercase, digits, and a special character (at least 10 characters).
 */
export function generateTemporaryPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$*";

  let result = "Tch!";

  // 4 random letters
  for (let i = 0; i < 4; i++) {
    result += letters[crypto.randomInt(0, letters.length)];
  }
  // 3 random numbers
  for (let i = 0; i < 3; i++) {
    result += numbers[crypto.randomInt(0, numbers.length)];
  }
  // 1 random special
  result += specials[crypto.randomInt(0, specials.length)];

  return result;
}

/**
 * Builds standard HTML and plain text email content for new teacher onboarding.
 */
export function buildTeacherWelcomeEmailContent({
  teacherEmail,
  teacherName,
  temporaryPassword,
  resetLink,
  collegeName = "Tutorial College",
  loginUrl = "https://tutorial-college-manager.vercel.app/login",
}: TeacherWelcomeEmailOptions): { subject: string; html: string; text: string } {
  const subject = `Your Teacher Account has been created - ${collegeName}`;

  const text = `
Dear ${teacherName},

Your teacher account has been successfully created in the ${collegeName} App.

You can now log in to the Teacher Portal to manage your assigned classes, take attendance, and view salary statements.

--- YOUR LOGIN DETAILS ---
Portal Login: ${loginUrl}
Email Address: ${teacherEmail}
Temporary Password: ${temporaryPassword || "(Not set - use setup link below)"}

${
  resetLink
    ? `You can also set your own permanent password directly using this secure link:\n${resetLink}\n`
    : ""
}

If you have any questions or require assistance, please contact the college administration.

Best regards,
${collegeName} Administration
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1C1F23;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E4E1DA; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1F5C4D; padding: 24px 32px; text-align: left;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;">
                ${collegeName}
              </h1>
              <p style="margin: 4px 0 0 0; color: #E6F0EC; font-size: 13px;">
                Teacher Portal Access
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1C1F23; font-size: 18px; font-weight: 600;">
                Welcome, ${teacherName}!
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #3A4048;">
                An official faculty account has been created for you in the <strong>${collegeName} App</strong>. You can now access your teacher dashboard to record attendance, manage class schedules, and review monthly salary summaries.
              </p>

              <!-- Credentials Box -->
              <div style="background-color: #FAF9F6; border: 1px solid #E4E1DA; border-radius: 6px; padding: 20px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 700; color: #5F6670; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                  Your Login Credentials
                </div>

                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #5F6670; width: 140px; font-size: 13px;">Login Portal:</td>
                    <td style="padding: 6px 0; font-weight: 600;">
                      <a href="${loginUrl}" style="color: #1F5C4D; text-decoration: none;">${loginUrl}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #5F6670; font-size: 13px;">Email Address:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #1C1F23;">${teacherEmail}</td>
                  </tr>
                  ${
                    temporaryPassword
                      ? `
                  <tr>
                    <td style="padding: 6px 0; color: #5F6670; font-size: 13px;">Temporary Password:</td>
                    <td style="padding: 6px 0;">
                      <code style="background-color: #E6F0EC; color: #1F5C4D; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: 700;">
                        ${temporaryPassword}
                      </code>
                    </td>
                  </tr>`
                      : ""
                  }
                </table>
              </div>

              <!-- Action Button -->
              <div style="text-align: center; margin: 28px 0 24px 0;">
                <a href="${loginUrl}" style="display: inline-block; background-color: #1F5C4D; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  Sign In to Teacher Portal &rarr;
                </a>
              </div>

              ${
                resetLink
                  ? `
              <!-- Reset Password Link -->
              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #5F6670; text-align: center;">
                Prefer to set your own password right away? Use this secure link:<br>
                <a href="${resetLink}" style="color: #1F5C4D; word-break: break-all;">${resetLink}</a>
              </p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9F6; border-top: 1px solid #E4E1DA; padding: 16px 32px; text-align: center; font-size: 12px; color: #5F6670;">
              &copy; ${new Date().getFullYear()} ${collegeName}. All rights reserved.<br>
              This is an automated administrative notification.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, html, text };
}

/**
 * Sends a welcome email with credentials to a newly registered teacher.
 * Automatically checks:
 * 1. SMTP transport (SMTP_HOST, SMTP_USER, etc.)
 * 2. Resend API (RESEND_API_KEY)
 * 3. Firestore 'mail' collection (Firebase Trigger Email extension compatible)
 * 4. Fallback dev logger
 */
export async function sendTeacherWelcomeEmail(
  options: TeacherWelcomeEmailOptions
): Promise<EmailDispatchResult> {
  const { teacherEmail, collegeName = "Tutorial College" } = options;
  const { subject, html, text } = buildTeacherWelcomeEmailContent(options);

  // 1. Record in Firestore 'mail' collection (works out-of-the-box with Firebase Trigger Email extension)
  try {
    await adminDb.collection("mail").add({
      to: teacherEmail,
      message: {
        subject,
        html,
        text,
      },
      createdAt: new Date().toISOString(),
      metadata: {
        type: "teacher_welcome",
        collegeName,
      },
    });
  } catch (err) {
    console.warn("Could not save to Firestore 'mail' collection:", err);
  }

  // 2. Check for SMTP credentials in environment
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"${collegeName}" <no-reply@tutorial-college.lk>`;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: teacherEmail,
        subject,
        text,
        html,
      });

      return {
        success: true,
        delivered: true,
        message: `Welcome email sent successfully to ${teacherEmail} via SMTP.`,
      };
    } catch (err: any) {
      console.error("SMTP email delivery failed:", err);
      return {
        success: false,
        delivered: false,
        message: `SMTP error: ${err.message || "Failed to send email"}`,
      };
    }
  }

  // 3. Check for Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: smtpFrom,
          to: [teacherEmail],
          subject,
          html,
          text,
        }),
      });

      if (res.ok) {
        return {
          success: true,
          delivered: true,
          message: `Welcome email sent successfully to ${teacherEmail} via Resend.`,
        };
      } else {
        const errorText = await res.text();
        console.warn("Resend API error:", errorText);
      }
    } catch (err: any) {
      console.error("Resend delivery failed:", err);
    }
  }

  // 4. Default / Dev Mode: Log email to server console
  console.log(
    `[Email Service] (Dev / Queued) Teacher welcome email for ${teacherEmail}:\nSubject: ${subject}\nTemporary Password: ${options.temporaryPassword}\nLogin URL: ${options.loginUrl}\nReset Link: ${options.resetLink}`
  );

  return {
    success: true,
    delivered: false,
    message: `Account created! Email queued in Firestore and logged. To send live emails, configure SMTP_HOST and SMTP_USER in your environment.`,
  };
}
