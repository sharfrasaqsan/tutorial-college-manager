"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
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
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Calendar,
  CreditCard,
  Users,
  CheckCircle2,
  Lock,
  Mail,
  Info,
  Sparkles,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<"idle" | "verifying" | "redirecting">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

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
      const idToken = await userCredential.user.getIdToken();

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

      // Safety fallback: if client router hasn't left /login within 800ms, force browser navigation
      redirectTimerRef.current = setTimeout(() => {
        if (window.location.pathname === "/login") {
          window.location.replace(targetUrl);
        }
      }, 800);

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
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-5 py-4">
      {/* Mobile Branding Header (visible only on small screens) */}
      <div className="lg:hidden flex flex-col items-center text-center pb-2">
        <div className="w-12 h-12 rounded-xl bg-[#1F5C4D] text-white flex items-center justify-center shadow-xs mb-3">
          <GraduationCap className="w-6 h-6" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Tutorial College Manager
        </span>
        <h1 className="text-2xl font-serif font-bold text-[#1C1F23] tracking-tight mt-1">
          Sign In
        </h1>
        <p className="text-xs text-[#5F6670] mt-1">
          Owner and faculty administrative portal
        </p>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E6F0EC] text-[#1F5C4D] mb-2 border border-[#1F5C4D]/15">
          <Sparkles className="w-3 h-3" />
          <span>Institutional Portal</span>
        </span>
        <h1 className="text-3xl font-serif font-bold text-[#1C1F23] tracking-tight">
          Welcome Back
        </h1>
        <p className="text-xs text-[#5F6670] mt-1.5 leading-relaxed">
          Please enter your credentials to access your administrative dashboard.
        </p>
      </div>

      {/* Role Detection Pill Indicator */}
      <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[8px] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1C1F23] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#1F5C4D] inline-block animate-pulse"></span>
            Unified Access:
          </span>
          <span className="text-[#5F6670] text-[11px]">Owner &amp; Teacher</span>
        </div>
        <span className="text-[10.5px] font-medium text-[#1F5C4D] bg-white px-2 py-0.5 rounded border border-[#E4E1DA]">
          Auto-Detected Role
        </span>
      </div>

      {/* Error notification */}
      {errorMessage && <Toast message={errorMessage} variant="danger" />}

      {/* Main Login Card */}
      <Card className="p-6 sm:p-7 shadow-xs border border-[#E4E1DA] bg-white rounded-[10px]">
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Field id="login-email" label="Institutional Email" required>
            <div className="relative">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="e.g. admin@college.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="pl-9"
              />
              <Mail className="w-4 h-4 text-[#5F6670] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Field>

          <Field id="login-password" label="Password" required>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pl-9 pr-10"
              />
              <Lock className="w-4 h-4 text-[#5F6670] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6670] hover:text-[#1C1F23] p-1 rounded transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-[#5F6670]">
              Role assigned via college registry
            </span>
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetError("");
                setResetMessage("");
                setForgotOpen(true);
              }}
              className="text-xs font-medium text-[#1F5C4D] hover:underline min-h-[36px] flex items-center cursor-pointer"
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
            className="h-11 text-sm font-semibold tracking-wide shadow-xs mt-1"
          >
            {loadingStatus === "redirecting"
              ? "Opening dashboard..."
              : loadingStatus === "verifying"
              ? "Verifying credentials..."
              : "Sign In to Portal"}
          </Button>
        </form>
      </Card>

      {/* Public Visitor Notice */}
      <div className="p-3.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[8px] flex items-start gap-2.5 text-xs text-[#5F6670]">
        <Info className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-[#1C1F23] block">
            Student or Parent visitor?
          </span>
          <span>
            Logins are not required for students or parents. You can browse published class schedules and fee structures on the public website.
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-semibold text-[#1F5C4D]">
            <Link href="/timetable" className="hover:underline flex items-center gap-1">
              <span>View Timetable</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <span className="text-[#E4E1DA]">•</span>
            <Link href="/classes" className="hover:underline flex items-center gap-1">
              <span>Classes &amp; Fees</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Sheet */}
      <BottomSheet
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        description="Enter your registered email address to receive secure password recovery instructions."
      >
        <form onSubmit={handleSendReset} className="flex flex-col gap-4 py-2">
          {resetMessage && <Toast message={resetMessage} variant="success" />}
          {resetError && <Toast message={resetError} variant="danger" />}

          <Field id="reset-email" label="Account Email Address" required>
            <Input
              id="reset-email"
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
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#FAF9F6] text-[#1C1F23] selection:bg-[#1F5C4D] selection:text-white">
      {/* LEFT PANEL: Rich Institutional Brand Showcase (Desktop only) */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 bg-gradient-to-br from-[#1A453A] via-[#143B31] to-[#0D2922] text-white p-10 xl:p-14 flex-col justify-between relative overflow-hidden border-r border-[#1F5C4D]/30 shadow-xl">
        {/* Decorative background orbs & mesh */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#266E5C]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#0B1E19]/40 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding & Return Link */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            title="Return to public college website"
          >
            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-tight text-white block leading-tight">
                Tutorial College
              </span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-200/75 block">
                Management System
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-100/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-full transition-all text-[11.5px] font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Site</span>
          </Link>
        </div>

        {/* Center Institutional Features Showcase */}
        <div className="relative z-10 my-auto py-10 flex flex-col gap-6 max-w-lg">
          <div>
            <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider block mb-2">
              Integrated Campus Administration
            </span>
            <h2 className="text-3xl xl:text-4xl font-serif font-bold leading-tight text-white tracking-tight">
              Empowering Academic Excellence &amp; Operations.
            </h2>
            <p className="text-xs xl:text-sm text-emerald-100/80 mt-3 leading-relaxed">
              A comprehensive institutional platform engineered for college leadership, administrative staff, and faculty educators.
            </p>
          </div>

          {/* Three Feature Highlights */}
          <div className="flex flex-col gap-3.5 mt-2">
            <div className="p-3.5 rounded-[10px] bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3.5 hover:bg-white/[0.08] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#2D806D]/40 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Conflict-Free Master Timetable
                </h4>
                <p className="text-[11px] text-emerald-100/70 mt-0.5 leading-normal">
                  Multi-room clash enforcement, faculty allocation, and non-repeating extra session scheduling.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-[10px] bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3.5 hover:bg-white/[0.08] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#2D806D]/40 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Fee Tracking &amp; Faculty Payroll
                </h4>
                <p className="text-[11px] text-emerald-100/70 mt-0.5 leading-normal">
                  Real-time student collection receipts, admission fee tracking, and automated teacher revenue shares.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-[10px] bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-3.5 hover:bg-white/[0.08] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#2D806D]/40 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Scoped Faculty Portals
                </h4>
                <p className="text-[11px] text-emerald-100/70 mt-0.5 leading-normal">
                  Role-isolated teacher dashboards for student attendance marking and monthly held session progress.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Security Indicator */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-100/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>256-Bit SSL Encrypted Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
            <span className="font-medium text-emerald-200">Active Academic Year</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Focused Authentication Form */}
      <div className="col-span-12 lg:col-span-7 xl:col-span-7 flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16 min-h-screen relative">
        {/* Top Bar with Return link (mobile) and ThemeToggle */}
        <div className="w-full flex items-center justify-between mb-4">
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-xs text-[#5F6670] hover:text-[#1C1F23] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </Link>
          <div className="hidden lg:block"></div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Center Form Section */}
        <div className="my-auto">
          <Suspense
            fallback={
              <div className="w-full max-w-[420px] mx-auto p-4 flex flex-col gap-4">
                <Skeleton variant="rectangular" height={40} />
                <Skeleton variant="rectangular" height={240} />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-[#E4E1DA] text-center text-[11px] text-[#5F6670] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Tutorial College Manager &copy; {currentYear}. All rights reserved.
          </span>
          <span className="text-[10.5px]">
            Authorized Staff &amp; Faculty Access Only
          </span>
        </div>
      </div>
    </div>
  );
}
