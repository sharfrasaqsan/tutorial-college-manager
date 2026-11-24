"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ArrowLeft, Globe, Eye, Phone, MessageSquare, MapPin, Award, CheckCircle2, ExternalLink } from "lucide-react";
import type { PublicSiteSettings } from "@/types";

interface TeacherItem {
  id: string;
  name: string;
  subjects: string[];
  showOnPublicSite: boolean;
  photoUrl: string | null;
}

export default function PublicSiteEditorPage() {
  const [settings, setSettings] = useState<PublicSiteSettings>({
    heroPromise: "",
    heroSubtext: "",
    aboutText: "",
    keyFacts: {
      location: "",
      yearsRunning: "",
      gradesTaught: "",
    },
    whatsappNumber: "",
    mapUrl: "",
    admissionFeeNote: "",
    sections: {
      showHero: true,
      showKeyFacts: true,
      showClasses: true,
      showTeacherStrip: true,
      showContactBlock: true,
    },
  });

  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [teacherVisibility, setTeacherVisibility] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/owner/settings/public-site");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings(data.settings);
          }
          if (data.teachers) {
            setTeachers(data.teachers);
            const initialMap: Record<string, boolean> = {};
            data.teachers.forEach((t: TeacherItem) => {
              initialMap[t.id] = t.showOnPublicSite;
            });
            setTeacherVisibility(initialMap);
          }
        }
      } catch (err) {
        console.error("Failed to load public site settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function toggleTeacher(id: string) {
    setTeacherVisibility((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleSection(key: keyof PublicSiteSettings["sections"]) {
    setSettings((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: !prev.sections[key],
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSaving(true);

    try {
      const res = await fetch("/api/owner/settings/public-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          teacherVisibility,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save public site settings.");
      }

      setSuccessMessage("Public site settings published successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OwnerShell pageTitle="Public Site Settings" maxWidth="wide">
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/owner/more"
          className="inline-flex items-center text-xs text-[#5F6670] hover:text-[#1C1F23]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Settings
        </Link>
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs text-[#1F5C4D] hover:underline font-medium"
        >
          <span>View Public Website</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <PageHeader
        title="Public Website Editor"
        subtitle="Control what parents and visitors see. Nothing is published except what you enter."
      />

      {loading ? (
        <Card className="p-8 text-center text-xs text-[#5F6670]">
          Loading public site settings...
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Content Cards */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Section 1: Hero & Promise */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#1F5C4D]" />
                <CardTitle>Hero &amp; College Promise</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                The first statement parents see at the top of the homepage.
              </p>
            </CardHeader>

            <div className="flex flex-col gap-4">
              <Field id="heroPromise" label="One-line College Promise" hint="A warm, confident statement of purpose">
                <Input
                  value={settings.heroPromise || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, heroPromise: e.target.value })
                  }
                  placeholder="e.g. Dedicated to building disciplined minds and exceptional examination results."
                />
              </Field>

              <Field id="heroSubtext" label="Hero Subtitle / Introductory Note" hint="Optional 1-2 sentences beneath the main promise">
                <Textarea
                  rows={2}
                  value={settings.heroSubtext || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, heroSubtext: e.target.value })
                  }
                  placeholder="e.g. Experienced subject specialist teachers with proven track records in G.C.E. O/L and A/L examinations."
                />
              </Field>
            </div>
          </Card>

          {/* Section 2: Key Facts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#1F5C4D]" />
                <CardTitle>Key Facts</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Clear summary points displayed as quick-read badges for parents.
              </p>
            </CardHeader>

            <div className="flex flex-col gap-4">
              <Field id="keyFactsLocation" label="Location Highlight">
                <Input
                  value={settings.keyFacts?.location || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      keyFacts: { ...settings.keyFacts, location: e.target.value },
                    })
                  }
                  placeholder="e.g. Colombo 04 (Near Bambalapitiya Junction)"
                />
              </Field>

              <Field id="keyFactsYears" label="Years Running / Established Experience">
                <Input
                  value={settings.keyFacts?.yearsRunning || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      keyFacts: { ...settings.keyFacts, yearsRunning: e.target.value },
                    })
                  }
                  placeholder="e.g. 12 Years of continuous teaching excellence"
                />
              </Field>

              <Field id="keyFactsGrades" label="Grades Taught">
                <Input
                  value={settings.keyFacts?.gradesTaught || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      keyFacts: { ...settings.keyFacts, gradesTaught: e.target.value },
                    })
                  }
                  placeholder="e.g. Grade 6 through Grade 13 (O/L & A/L)"
                />
              </Field>
            </div>
          </Card>

          {/* Section 3: WhatsApp & Admission Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1F5C4D]" />
                <CardTitle>Direct Actions &amp; Admission Note</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Direct communication channels and policy notices.
              </p>
            </CardHeader>

            <div className="flex flex-col gap-4">
              <Field id="whatsappNumber" label="WhatsApp Contact Number" hint="Format: +9477XXXXXXX or 077XXXXXXX">
                <Input
                  value={settings.whatsappNumber || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, whatsappNumber: e.target.value })
                  }
                  placeholder="+94 77 123 4567"
                />
              </Field>

              <Field id="mapUrl" label="Google Maps Link" hint="Paste URL for location directions">
                <Input
                  value={settings.mapUrl || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, mapUrl: e.target.value })
                  }
                  placeholder="https://maps.google.com/?q=..."
                />
              </Field>

              <Field id="admissionFeeNote" label="Admission Fee Note" hint="Shown on the public classes & fees page">
                <Input
                  value={settings.admissionFeeNote || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, admissionFeeNote: e.target.value })
                  }
                  placeholder="e.g. A one-time registration fee of LKR 2,500 applies for new admissions."
                />
              </Field>

              <Field id="aboutText" label="About the College (Public Details)">
                <Textarea
                  rows={4}
                  value={settings.aboutText || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, aboutText: e.target.value })
                  }
                  placeholder="Share the history, ethos, classroom culture, and teaching philosophy with prospective families..."
                />
              </Field>
            </div>
          </Card>
          </div>

          {/* Right Column: Controls & Visibility */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Section 4: Section Visibility Toggles */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#1F5C4D]" />
                <CardTitle>Homepage Sections Visibility</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Toggle which sections appear on the parent-facing homepage.
              </p>
            </CardHeader>

            <div className="flex flex-col divide-y divide-[#E4E1DA] text-xs">
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#1C1F23]">Hero &amp; Promise Header</div>
                  <div className="text-[#5F6670]">College name, logo, promise, Call and WhatsApp buttons</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sections?.showHero ?? true}
                  onChange={() => toggleSection("showHero")}
                  className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#1C1F23]">Key Facts Badges</div>
                  <div className="text-[#5F6670]">Location, years running, and grades taught</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sections?.showKeyFacts ?? true}
                  onChange={() => toggleSection("showKeyFacts")}
                  className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#1C1F23]">Classes by Grade Preview</div>
                  <div className="text-[#5F6670]">Displays course roster and fee summaries</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sections?.showClasses ?? true}
                  onChange={() => toggleSection("showClasses")}
                  className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#1C1F23]">Teacher Strip</div>
                  <div className="text-[#5F6670]">Faculty showcase with photo and subjects</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sections?.showTeacherStrip ?? true}
                  onChange={() => toggleSection("showTeacherStrip")}
                  className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#1C1F23]">Contact &amp; Hours Block</div>
                  <div className="text-[#5F6670]">Address, phone, email, opening hours &amp; directions</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sections?.showContactBlock ?? true}
                  onChange={() => toggleSection("showContactBlock")}
                  className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                />
              </div>
            </div>
          </Card>

          {/* Section 5: Teacher Visibility Control */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1F5C4D]" />
                <CardTitle>Teacher Visibility on Public Site</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Select which registered teachers appear on the public website. Teacher phone and email are permanently private and never displayed publicly.
              </p>
            </CardHeader>

            {teachers.length === 0 ? (
              <p className="text-xs text-[#5F6670] py-2">No active teachers registered yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-[#E4E1DA] text-xs">
                {teachers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      {t.photoUrl ? (
                        <img
                          src={t.photoUrl}
                          alt={t.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#E4E1DA]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-semibold text-xs">
                          {t.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-[#1C1F23]">{t.name}</div>
                        <div className="text-[11px] text-[#5F6670]">
                          {t.subjects.length > 0 ? t.subjects.join(", ") : "No subjects assigned"}
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-[11px] text-[#5F6670]">
                        {teacherVisibility[t.id] ? "Visible" : "Hidden"}
                      </span>
                      <input
                        type="checkbox"
                        checked={teacherVisibility[t.id] ?? false}
                        onChange={() => toggleTeacher(t.id)}
                        className="w-4 h-4 accent-[#1F5C4D] cursor-pointer"
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </Card>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full sm:w-auto"
                disabled={saving}
              >
                {saving ? "Publishing Changes..." : "Save & Publish Public Site"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {successMessage && (
        <Toast
          message={successMessage}
          variant="success"
          onDismiss={() => setSuccessMessage("")}
        />
      )}

      {errorMessage && (
        <Toast
          message={errorMessage}
          variant="danger"
          onDismiss={() => setErrorMessage("")}
        />
      )}
    </OwnerShell>
  );
}
