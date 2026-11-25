"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<"idle" | "verifying" | "redirecting">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setLoading(true);
    setLoadingStatus("verifying");

    try {
      // 1. Sign in with Firebase Client Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await userCredential.user.getIdToken(true);

      // 2. Exchange ID token for a secure HTTP-only session cookie
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      let data: any = null;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          error: `Server returned HTTP ${response.status}. Please check Vercel environment variables.`,
        };
      }

      if (!response.ok) {
        throw new Error(data?.error || `Unable to establish server session (HTTP ${response.status}).`);
      }

      // 3. Determine redirect based on custom claim role
      const userRole = data.role;
      let targetUrl = userRole === "owner" ? "/owner" : "/teacher";
      if (fromParam) {
        if (fromParam.startsWith("/owner") && userRole === "owner") {
          targetUrl = fromParam;
        } else if (fromParam.startsWith("/teacher") && userRole === "teacher") {
          targetUrl = fromParam;
        }
      }

      // 4. Update status and initiate seamless client transition
      setLoadingStatus("redirecting");
      router.replace(targetUrl);

      return;
    } catch (err: any) {
      setLoading(false);
      setLoadingStatus("idle");
      console.error("Login error:", err);
      const code = err.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-email"
      ) {
        setErrorMessage("The email address or password you entered is incorrect.");
      } else if (code === "auth/too-many-requests") {
        setErrorMessage("Too many unsuccessful attempts. Please wait a few moments before trying again.");
      } else if (code === "auth/user-disabled") {
        setErrorMessage("This account has been disabled. Please contact the college owner.");
      } else {
        setErrorMessage(err.message || "An error occurred during sign-in. Please try again.");
      }
    }
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage(`A password reset link has been sent to ${resetEmail.trim()}. Check your inbox.`);
      setResetEmail("");
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err.code === "auth/user-not-found") {
        setResetError("No account found with this email address.");
      } else if (err.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else {
        setResetError("Failed to send password reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[375px] sm:max-w-md mx-auto flex flex-col gap-6">
      {/* College Header */}
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Tutorial College Manager
        </span>
        <h1 className="text-2xl font-serif font-semibold text-[#1C1F23] mt-1.5 tracking-tight">
          Sign In
        </h1>
        <p className="text-xs text-[#5F6670] mt-1">
          Owner and teacher portal access
        </p>
      </div>

      {/* Error notification */}
      {errorMessage && <Toast message={errorMessage} variant="danger" />}

      {/* Login Card */}
      <Card className="p-6 sm:p-7 shadow-xs">
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Field id="login-email" label="Email Address" required>
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@college.lk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </Field>

          <Field id="login-password" label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </Field>

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetError("");
                setResetMessage("");
                setForgotOpen(true);
              }}
              className="text-xs text-[#1F5C4D] hover:underline min-h-[36px] flex items-center"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {loadingStatus === "redirecting"
              ? "Opening dashboard..."
              : loadingStatus === "verifying"
              ? "Signing in..."
              : "Sign In"}
          </Button>
        </form>
      </Card>

      {/* Plain Notice */}
      <div className="text-center">
        <p className="text-xs text-[#5F6670] leading-relaxed">
          Parents and students do not require logins. Public timetables and fees can be viewed on the home page.
        </p>
      </div>

      {/* Forgot Password Sheet */}
      <BottomSheet
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        description="We will send a secure link to reset your account password."
      >
        <form onSubmit={handleSendReset} className="flex flex-col gap-4 py-2">
          {resetMessage && <Toast message={resetMessage} variant="success" />}
          {resetError && <Toast message={resetError} variant="danger" />}

          <Field id="reset-email" label="Account Email Address" required>
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@college.lk"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={resetLoading}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={resetLoading}
            disabled={resetLoading}
          >
            Send Reset Link
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => setForgotOpen(false)}
            disabled={resetLoading}
          >
            Close
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1C1F23] flex flex-col justify-center px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full max-w-[375px] sm:max-w-md mx-auto p-4 flex flex-col gap-4">
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={180} />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
