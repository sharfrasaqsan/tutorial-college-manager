"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import {
  LogOut,
  KeyRound,
  GraduationCap,
  Calendar,
  Banknote,
  Bell,
  ChevronRight,
  UserCheck,
} from "lucide-react";

export default function TeacherMorePage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation password do not match.");
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setErrorMessage("You must be signed in to change your password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Re-authenticate teacher with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update password
      await updatePassword(user, newPassword);

      setSuccessMessage("Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMessage("Your current password is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setErrorMessage("The new password is too weak. Please use at least 8 characters.");
      } else {
        setErrorMessage(err.message || "Failed to update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut(auth);
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
      window.location.replace("/login");
    }
  }

  return (
    <TeacherShell pageTitle="Settings & Profile" maxWidth="wide">
      <PageHeader
        title="Settings & Security"
        subtitle="Account preferences, security credentials & quick portal navigation"
      />

      {successMessage && (
        <div className="mb-4">
          <Toast
            message={successMessage}
            variant="success"
            onDismiss={() => setSuccessMessage("")}
          />
        </div>
      )}
      {errorMessage && (
        <div className="mb-4">
          <Toast
            message={errorMessage}
            variant="danger"
            onDismiss={() => setErrorMessage("")}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">
        {/* Left Column (7 cols): Change Password Card */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound
                  className="w-4 h-4 text-[#1F5C4D]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <CardTitle>Change Password</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Update your login password regularly to keep your account secure.
              </p>
            </CardHeader>

            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <Field id="current-password" label="Current Password" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <Field
                  id="new-password"
                  label="New Password"
                  required
                  hint="Must be at least 8 characters"
                >
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                </Field>

                <Field id="confirm-password" label="Confirm Password" required>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </Field>
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full sm:w-auto px-6 h-9"
                  loading={loading}
                  disabled={loading}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column (5 cols): Quick Faculty Links & Account Session */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quick Faculty Navigation Cards */}
          <Card className="p-4 border border-[#E4E1DA]">
            <CardHeader className="p-0 pb-3 border-b border-[#E4E1DA]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Faculty Portals</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Direct shortcuts to your teaching workspaces
              </p>
            </CardHeader>

            <div className="mt-3 divide-y divide-[#E4E1DA] text-xs">
              <Link
                href="/teacher/classes"
                className="py-2.5 flex items-center justify-between hover:bg-[#FAF9F6] px-1 rounded transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors">
                      My Assigned Classes
                    </div>
                    <div className="text-[11px] text-[#5F6670]">Student rosters &amp; active subjects</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#5F6670] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/teacher/timetable"
                className="py-2.5 flex items-center justify-between hover:bg-[#FAF9F6] px-1 rounded transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors">
                      Weekly Timetable
                    </div>
                    <div className="text-[11px] text-[#5F6670]">Class schedules &amp; session times</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#5F6670] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/teacher/salary"
                className="py-2.5 flex items-center justify-between hover:bg-[#FAF9F6] px-1 rounded transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <Banknote className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors">
                      Salary &amp; Invoices
                    </div>
                    <div className="text-[11px] text-[#5F6670]">Payment slips &amp; monthly earnings</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#5F6670] group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/teacher/notifications"
                className="py-2.5 flex items-center justify-between hover:bg-[#FAF9F6] px-1 rounded transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors">
                      Notifications
                    </div>
                    <div className="text-[11px] text-[#5F6670]">Timetable changes &amp; salary notices</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#5F6670] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Account Session Actions */}
          <Card className="p-4 border border-[#E4E1DA]">
            <CardHeader className="p-0 pb-2">
              <CardTitle>Faculty Session</CardTitle>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Signed in as verified teacher
              </p>
            </CardHeader>
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleSignOut}
                className="text-xs h-9"
              >
                <LogOut className="w-4 h-4 mr-2 text-[#5F6670]" strokeWidth={1.75} aria-hidden="true" />
                Sign Out
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </TeacherShell>
  );
}
