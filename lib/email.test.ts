import { test, describe } from "node:test";
import assert from "node:assert";
import {
  generateTemporaryPassword,
  buildTeacherWelcomeEmailContent,
} from "./email.ts";
import { CreateTeacherSchema } from "./teachers.ts";

describe("Teacher Account Automation & Email Notifications", () => {
  test("generateTemporaryPassword generates strong, valid passwords", () => {
    const password = generateTemporaryPassword();
    assert.ok(password.length >= 10, "Password should be at least 10 characters long");
    assert.ok(password.startsWith("Tch!"), "Password should have recognizable prefix");
    assert.match(password, /[A-Za-z]/, "Password must contain letters");
    assert.match(password, /[0-9]/, "Password must contain numbers");
  });

  test("buildTeacherWelcomeEmailContent builds comprehensive email templates", () => {
    const content = buildTeacherWelcomeEmailContent({
      teacherEmail: "test.teacher@college.lk",
      teacherName: "Prof. Perera",
      temporaryPassword: "Tch!SecurePass99*",
      resetLink: "https://auth.example.com/reset?token=abc",
      collegeName: "Apex Tutorial College",
      loginUrl: "https://college.lk/login",
    });

    assert.ok(content.subject.includes("Apex Tutorial College"));
    assert.ok(content.subject.includes("Teacher Account has been created"));

    // Check plain text content
    assert.ok(content.text.includes("Prof. Perera"));
    assert.ok(content.text.includes("test.teacher@college.lk"));
    assert.ok(content.text.includes("Tch!SecurePass99*"));
    assert.ok(content.text.includes("https://college.lk/login"));
    assert.ok(content.text.includes("https://auth.example.com/reset?token=abc"));
    assert.ok(content.text.includes("Apex Tutorial College"));

    // Check HTML content
    assert.ok(content.html.includes("Prof. Perera"));
    assert.ok(content.html.includes("test.teacher@college.lk"));
    assert.ok(content.html.includes("Tch!SecurePass99*"));
    assert.ok(content.html.includes("https://college.lk/login"));
    assert.ok(content.html.includes("https://auth.example.com/reset?token=abc"));
    assert.ok(content.html.includes("Apex Tutorial College"));
  });

  test("CreateTeacherSchema accepts teacher with or without initial password", () => {
    // Valid with no password (auto-generate mode)
    const validNoPassword = CreateTeacherSchema.safeParse({
      name: "Silva",
      email: "silva@college.lk",
      phone: "0771234567",
      subjects: ["Combined Maths"],
    });
    assert.strictEqual(validNoPassword.success, true);

    // Valid with custom password
    const validWithPassword = CreateTeacherSchema.safeParse({
      name: "Silva",
      email: "silva@college.lk",
      phone: "0771234567",
      password: "CustomPassword123!",
      subjects: ["Physics"],
    });
    assert.strictEqual(validWithPassword.success, true);

    // Invalid password under 6 characters
    const invalidShortPassword = CreateTeacherSchema.safeParse({
      name: "Silva",
      email: "silva@college.lk",
      phone: "0771234567",
      password: "123",
    });
    assert.strictEqual(invalidShortPassword.success, false);
  });
});
