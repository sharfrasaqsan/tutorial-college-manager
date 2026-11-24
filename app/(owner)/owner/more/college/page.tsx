"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ArrowLeft, Upload, Building2 } from "lucide-react";
import type { CollegeProfile } from "@/types";

export default function CollegeProfilePage() {
  const [profile, setProfile] = useState<CollegeProfile>({
    name: "",
    logoUrl: "",
    address: "",
    phone: "",
    email: "",
    aboutText: "",
    openingHours: "",
    updatedAt: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/owner/settings/college");
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
          }
        }
      } catch (err) {
        console.error("Failed to load college profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!profile.name.trim() || !profile.address.trim() || !profile.phone.trim() || !profile.email.trim()) {
      setErrorMessage("Please complete all required fields (Name, Address, Phone, Email).");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/owner/settings/college", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update college profile.");
      }

      setProfile(data.profile);
      setSuccessMessage("College profile updated successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/owner/settings/college/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload logo.");
      }

      setProfile((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      setSuccessMessage("Logo uploaded and updated successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <OwnerShell pageTitle="College Profile">
      <div className="mb-2">
        <Link
          href="/owner/more"
          className="inline-flex items-center text-xs font-medium text-[#1F5C4D] hover:underline min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
          Back to More
        </Link>
      </div>

      <PageHeader
        title="College Profile"
        subtitle="Public branding, contact details & operating hours"
      />

      {successMessage && (
        <div className="mb-4">
          <Toast message={successMessage} variant="success" onDismiss={() => setSuccessMessage("")} />
        </div>
      )}
      {errorMessage && (
        <div className="mb-4">
          <Toast message={errorMessage} variant="danger" onDismiss={() => setErrorMessage("")} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Logo Card */}
        <Card className="p-4 flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-[6px] border border-[#E4E1DA] bg-[#FAF9F6] flex items-center justify-center overflow-hidden relative">
            {profile.logoUrl ? (
              <Image
                src={profile.logoUrl}
                alt="College Logo"
                fill
                className="object-contain p-1"
                unoptimized
              />
            ) : (
              <Building2 className="w-8 h-8 text-[#5F6670]" strokeWidth={1.75} />
            )}
          </div>

          <label className="cursor-pointer">
            <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-[#E4E1DA] bg-[#FFFFFF] text-[#1C1F23] rounded-[6px] hover:bg-[#FAF9F6] transition-colors min-h-[44px]">
              <Upload className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              {uploadingLogo ? "Uploading..." : "Upload Logo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
            />
          </label>
          <p className="text-[11px] text-[#5F6670]">
            Displayed on salary invoices and the public website.
          </p>
        </Card>

        {/* Basic Info Card */}
        <Card className="flex flex-col gap-3.5">
          <Field id="college-name" label="College Name" required>
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="e.g. Apex Academic Institute"
              disabled={loading || saving}
            />
          </Field>

          <Field id="college-address" label="Campus Address" required>
            <Input
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="e.g. 142 Galle Road, Colombo 03"
              disabled={loading || saving}
            />
          </Field>

          <Field id="college-phone" label="Contact Telephone" required>
            <Input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="e.g. +94 11 234 5678"
              disabled={loading || saving}
            />
          </Field>

          <Field id="college-email" label="Official Email Address" required>
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="e.g. info@apexcollege.lk"
              disabled={loading || saving}
            />
          </Field>

          <Field id="opening-hours" label="Opening Hours" hint="Weekly operational schedule">
            <Input
              value={profile.openingHours}
              onChange={(e) => setProfile({ ...profile, openingHours: e.target.value })}
              placeholder="e.g. Mon-Sat: 8:00 AM - 6:00 PM, Sun: 8:00 AM - 1:00 PM"
              disabled={loading || saving}
            />
          </Field>

          <Field id="college-about" label="Short About Text" hint="Brief overview shown on the public site">
            <Textarea
              value={profile.aboutText}
              onChange={(e) => setProfile({ ...profile, aboutText: e.target.value })}
              placeholder="State the college mission, faculties, and academic goals..."
              disabled={loading || saving}
            />
          </Field>
        </Card>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={saving}
          disabled={loading || saving}
        >
          Save College Profile
        </Button>
      </form>
    </OwnerShell>
  );
}
