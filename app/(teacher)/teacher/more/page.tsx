"use client";

import React, { useState } from "react";
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
import { LogOut, KeyRound } from "lucide-react";

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
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      router.push("/login");
    }
  }

  return (
    <TeacherShell pageTitle="Settings & Profile">
      <PageHeader
        title="Settings & Security"
        subtitle="Account preferences & password management"
      />

      <div className="flex flex-col gap-5">
        {successMessage && (
          <Toast message={successMessage} variant="success" onDismiss={() => setSuccessMessage("")} />
        )}
        {errorMessage && (
          <Toast message={errorMessage} variant="danger" onDismiss={() => setErrorMessage("")} />
        )}

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} aria-hidden="true" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <p className="text-xs text-[#5F6670] mt-1">
              Update your login password regularly to keep your account secure.
            </p>
          </CardHeader>

          <form onSubmit={handlePasswordChange} className="flex flex-col gap-3.5">
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

            <Field
              id="new-password"
              label="New Password"
              required
              hint="Must contain at least 8 characters"
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

            <Field id="confirm-password" label="Confirm New Password" required>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </Field>

            <div className="mt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                disabled={loading}
              >
                Update Password
              </Button>
            </div>
          </form>
        </Card>

        {/* Account Session Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account Session</CardTitle>
            <p className="text-xs text-[#5F6670] mt-1">
              Signed in as faculty member
            </p>
          </CardHeader>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2 text-[#5F6670]" strokeWidth={1.75} aria-hidden="true" />
            Sign Out
          </Button>
        </Card>
      </div>
    </TeacherShell>
  );
}
