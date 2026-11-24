"use client";

import React, { useState, useEffect } from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import {
  Users,
  Plus,
  Mail,
  Phone,
  BookOpen,
  Edit,
  UserX,
  UserCheck,
  Upload,
  Copy,
  Check,
  EyeOff,
  Globe,
} from "lucide-react";
import type { Teacher, AcademicSubject } from "@/types";

export default function OwnerTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Add/Edit sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formShowOnPublic, setFormShowOnPublic] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Setup link modal after creation
  const [setupLinkModalOpen, setSetupLinkModalOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [setupLink, setSetupLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Status toggle dialog
  const [statusDialogTeacher, setStatusDialogTeacher] = useState<Teacher | null>(null);
  const [statusToggling, setStatusToggling] = useState(false);

  useEffect(() => {
    loadTeachers();
    loadSubjects();
  }, []);

  async function loadTeachers() {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/teachers");
      const data = await res.json();
      if (res.ok) {
        setTeachers(data.teachers || []);
      } else {
        showToast(data.error || "Failed to load teachers.", "danger");
      }
    } catch {
      showToast("Unable to connect to server.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjects() {
    try {
      const res = await fetch("/api/owner/settings/academic");
      const data = await res.json();
      if (res.ok && data.subjects) {
        const activeSubjs = data.subjects
          .filter((s: AcademicSubject) => !s.hidden)
          .map((s: AcademicSubject) => s.name);
        setAvailableSubjects(activeSubjs);
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function openAddSheet() {
    setEditingTeacher(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormBio("");
    setFormSubjects([]);
    setFormPhotoUrl("");
    setFormShowOnPublic(true);
    setFormError("");
    setSheetOpen(true);
  }

  function openEditSheet(teacher: Teacher) {
    setEditingTeacher(teacher);
    setFormName(teacher.name);
    setFormEmail(teacher.email);
    setFormPhone(teacher.phone || "");
    setFormBio(teacher.bio || "");
    setFormSubjects(teacher.subjects || []);
    setFormPhotoUrl(teacher.photoUrl || "");
    setFormShowOnPublic(teacher.showOnPublicSite !== false);
    setFormError("");
    setSheetOpen(true);
  }

  function toggleSubjectSelection(subject: string) {
    if (formSubjects.includes(subject)) {
      setFormSubjects(formSubjects.filter((s) => s !== subject));
    } else {
      setFormSubjects([...formSubjects, subject]);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/owner/teachers/photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.photoUrl) {
        setFormPhotoUrl(data.photoUrl);
        showToast("Photo uploaded successfully.", "success");
      } else {
        showToast(data.error || "Failed to upload photo.", "danger");
      }
    } catch {
      showToast("Error uploading photo file.", "danger");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveTeacher(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!editingTeacher && !formEmail.trim()) {
      setFormError("Email address is required for teacher login.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Contact phone number is required.");
      return;
    }

    try {
      setFormSaving(true);
      if (editingTeacher) {
        // Edit teacher
        const res = await fetch(`/api/owner/teachers/${editingTeacher.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            phone: formPhone.trim(),
            photoUrl: formPhotoUrl || undefined,
            bio: formBio.trim() || undefined,
            subjects: formSubjects,
            showOnPublicSite: formShowOnPublic,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSheetOpen(false);
          showToast("Teacher profile updated successfully.", "success");
          loadTeachers();
        } else {
          setFormError(data.error || "Failed to update teacher.");
        }
      } else {
        // Add new teacher
        const res = await fetch("/api/owner/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            phone: formPhone.trim(),
            photoUrl: formPhotoUrl || undefined,
            bio: formBio.trim() || undefined,
            subjects: formSubjects,
            showOnPublicSite: formShowOnPublic,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSheetOpen(false);
          setNewTeacherName(formName.trim());
          setSetupLink(data.resetLink || "");
          setSetupLinkModalOpen(true);
          loadTeachers();
        } else {
          setFormError(data.error || "Failed to create teacher.");
        }
      }
    } catch {
      setFormError("Server error occurred while saving teacher.");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!statusDialogTeacher) return;

    try {
      setStatusToggling(true);
      const nextActive = !statusDialogTeacher.active;
      const res = await fetch(`/api/owner/teachers/${statusDialogTeacher.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(
          nextActive
            ? `${statusDialogTeacher.name} reactivated.`
            : `${statusDialogTeacher.name} deactivated.`,
          "success"
        );
        setStatusDialogTeacher(null);
        loadTeachers();
      } else {
        showToast(data.error || "Failed to update status.", "danger");
      }
    } catch {
      showToast("Server error updating status.", "danger");
    } finally {
      setStatusToggling(false);
    }
  }

  function copySetupLink() {
    navigator.clipboard.writeText(setupLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  const filteredTeachers = teachers.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = t.name.toLowerCase().includes(q);
    const emailMatch = t.email.toLowerCase().includes(q);
    const phoneMatch = t.phone?.toLowerCase().includes(q);
    const subjMatch = t.subjects?.some((s) => s.toLowerCase().includes(q));
    return nameMatch || emailMatch || phoneMatch || subjMatch;
  });

  return (
    <OwnerShell pageTitle="Teachers">
      <PageHeader
        title="College Faculty"
        subtitle="Manage permanent teacher records, subject assignments and login accounts"
        action={
          <Button variant="primary" onClick={openAddSheet} className="gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Add Teacher</span>
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search by teacher name, email, phone or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton height="88px" />
          <Skeleton height="88px" />
          <Skeleton height="88px" />
        </div>
      ) : (
        <DataTable
          data={filteredTeachers}
          keyExtractor={(t) => t.id}
          columns={[
            {
              key: "name",
              header: "Faculty Member",
              render: (teacher) => (
                <div className="flex items-center gap-3">
                  {teacher.photoUrl ? (
                    <img
                      src={teacher.photoUrl}
                      alt={teacher.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#E4E1DA] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-semibold text-sm border border-[#E4E1DA] shrink-0">
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm text-[#1C1F23]">{teacher.name}</div>
                    {teacher.bio && (
                      <div className="text-[11px] text-[#5F6670] line-clamp-1 italic max-w-xs">
                        {teacher.bio}
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "subjects",
              header: "Curriculum Subjects",
              render: (teacher) => (
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {teacher.subjects && teacher.subjects.length > 0 ? (
                    teacher.subjects.map((subj) => (
                      <span
                        key={subj}
                        className="px-2 py-0.5 text-[11px] rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23]"
                      >
                        {subj}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#5F6670] italic">No subjects assigned</span>
                  )}
                </div>
              ),
            },
            {
              key: "contact",
              header: "Contact",
              render: (teacher) => (
                <div className="text-xs">
                  <div className="text-[#1C1F23]">{teacher.email}</div>
                  {teacher.phone && (
                    <div className="text-[#5F6670] tabular-nums mt-0.5">{teacher.phone}</div>
                  )}
                </div>
              ),
            },
            {
              key: "visibility",
              header: "Public Site",
              render: (teacher) => (
                teacher.showOnPublicSite ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded">
                    <Globe className="w-3 h-3" />
                    Visible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5F6670] bg-[#FAF9F6] border border-[#E4E1DA] px-2 py-0.5 rounded">
                    <EyeOff className="w-3 h-3" />
                    Hidden
                  </span>
                )
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (teacher) => (
                <StatusChip
                  status={teacher.active ? "success" : "danger"}
                  label={teacher.active ? "Active" : "Deactivated"}
                />
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (teacher) => (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="quiet"
                    onClick={() => openEditSheet(teacher)}
                    className="text-xs h-7 px-2.5 gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant={teacher.active ? "quiet" : "secondary"}
                    onClick={() => setStatusDialogTeacher(teacher)}
                    className={`text-xs h-7 px-2.5 gap-1 ${
                      teacher.active ? "text-[#A32A2A] hover:bg-[#FBE9E7]" : "text-[#1F5C4D]"
                    }`}
                  >
                    {teacher.active ? (
                      <>
                        <UserX className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Activate</span>
                      </>
                    )}
                  </Button>
                </div>
              ),
            },
          ]}
          emptyState={
            <EmptyState
              title={search ? "No matching teachers found" : "No teachers registered yet"}
              description={
                search
                  ? "Try adjusting your search query."
                  : "Add your first teacher account to begin assigning classes and schedules."
              }
              icon={<Users className="w-8 h-8" strokeWidth={1.75} />}
              action={
                !search ? (
                  <Button variant="primary" onClick={openAddSheet}>
                    Add Teacher
                  </Button>
                ) : undefined
              }
            />
          }
          renderCard={(teacher) => (
            <Card key={teacher.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  {teacher.photoUrl ? (
                    <img
                      src={teacher.photoUrl}
                      alt={teacher.name}
                      className="w-11 h-11 rounded-full object-cover border border-[#E4E1DA] shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-semibold text-sm border border-[#E4E1DA] shrink-0">
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-sm text-[#1C1F23] flex items-center gap-2">
                      <span>{teacher.name}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5F6670] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {teacher.email}
                      </span>
                      {teacher.phone && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                          {teacher.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Chips */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusChip
                    status={teacher.active ? "success" : "danger"}
                    label={teacher.active ? "Active" : "Deactivated"}
                  />
                  {teacher.showOnPublicSite ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#1F5C4D]">
                      <Globe className="w-3 h-3" strokeWidth={1.75} />
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#5F6670]">
                      <EyeOff className="w-3 h-3" strokeWidth={1.75} />
                      Hidden
                    </span>
                  )}
                </div>
              </div>

              {/* Bio summary */}
              {teacher.bio && (
                <p className="text-xs text-[#5F6670] line-clamp-2 italic bg-[#FAF9F6] p-2 rounded border border-[#E4E1DA]">
                  &ldquo;{teacher.bio}&rdquo;
                </p>
              )}

              {/* Subjects */}
              {teacher.subjects && teacher.subjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E4E1DA]">
                  <span className="text-[11px] font-medium text-[#5F6670] flex items-center gap-1 mr-1">
                    <BookOpen className="w-3 h-3" strokeWidth={1.75} />
                    Subjects:
                  </span>
                  {teacher.subjects.map((subj) => (
                    <span
                      key={subj}
                      className="px-2 py-0.5 text-[11px] rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23]"
                    >
                      {subj}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
                <Button
                  variant="quiet"
                  onClick={() => openEditSheet(teacher)}
                  className="text-xs h-8 px-2.5 gap-1"
                >
                  <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Edit Profile</span>
                </Button>

                <Button
                  variant={teacher.active ? "quiet" : "secondary"}
                  onClick={() => setStatusDialogTeacher(teacher)}
                  className={`text-xs h-8 px-2.5 gap-1 ${
                    teacher.active ? "text-[#A32A2A] hover:bg-[#FBE9E7]" : "text-[#1F5C4D]"
                  }`}
                >
                  {teacher.active ? (
                    <>
                      <UserX className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Activate</span>
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}
        />
      )}

      {/* Add / Edit Teacher Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingTeacher ? "Edit Teacher Profile" : "Register New Teacher"}
      >
        <form onSubmit={handleSaveTeacher} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {formError}
            </div>
          )}

          <Field id="teacher-name" label="Full Name" required>
            <Input
              type="text"
              placeholder="e.g. Mr. K. Silva"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </Field>

          <Field
            id="teacher-email"
            label="Email Address"
            hint={
              editingTeacher
                ? "Login email cannot be changed once created."
                : "Used by teacher to log in. Password setup email will be sent."
            }
            required
          >
            <Input
              type="email"
              placeholder="e.g. silva@college.lk"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              disabled={Boolean(editingTeacher)}
              required
            />
          </Field>

          <Field id="teacher-phone" label="Contact Phone Number" required>
            <Input
              type="tel"
              placeholder="e.g. 077 123 4567"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              required
            />
          </Field>

          {/* Photo Upload */}
          <Field id="teacher-photo-field" label="Teacher Photo (Storage)" hint="Max size 5MB. Visible on public teacher profile.">
            <div className="flex items-center gap-3">
              {formPhotoUrl ? (
                <img
                  src={formPhotoUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover border border-[#E4E1DA]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#FAF9F6] border border-[#E4E1DA] flex items-center justify-center text-[#5F6670]">
                  <Upload className="w-5 h-5" strokeWidth={1.75} />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  id="teacher-photo"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="teacher-photo"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E4E1DA] rounded bg-white text-[#1C1F23] cursor-pointer hover:bg-[#FAF9F6]"
                >
                  <Upload className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>{uploadingPhoto ? "Uploading..." : formPhotoUrl ? "Change Photo" : "Upload Photo"}</span>
                </label>
              </div>
            </div>
          </Field>

          {/* Subjects Multi-Select */}
          <Field
            id="teacher-subjects-field"
            label="Subjects Taught"
            hint="Select all subjects this teacher is qualified to teach."
          >
            {availableSubjects.length === 0 ? (
              <p className="text-xs text-[#5F6670] italic">
                No subjects defined yet. Add subjects in More &gt; Grades &amp; Subjects.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableSubjects.map((subject) => {
                  const isSelected = formSubjects.includes(subject);
                  return (
                    <button
                      type="button"
                      key={subject}
                      onClick={() => toggleSubjectSelection(subject)}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        isSelected
                          ? "bg-[#1F5C4D] text-white border-[#1F5C4D]"
                          : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6]"
                      }`}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {/* Short Bio */}
          <Field id="teacher-bio" label="Short Bio" hint="Up to 1000 characters. Featured on teacher profile.">
            <Textarea
              rows={3}
              placeholder="e.g. Over 10 years experience teaching Combined Maths for London and Local A/L syllabus."
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              maxLength={1000}
            />
          </Field>

          {/* Public Profile Visibility Switch */}
          <div className="flex items-center justify-between p-3 rounded border border-[#E4E1DA] bg-[#FAF9F6]">
            <div>
              <span className="text-xs font-semibold text-[#1C1F23] block">
                Show on Public Website
              </span>
              <span className="text-[11px] text-[#5F6670] block">
                Display teacher bio and subjects on public faculty page (phone &amp; email remain private).
              </span>
            </div>
            <input
              type="checkbox"
              checked={formShowOnPublic}
              onChange={(e) => setFormShowOnPublic(e.target.checked)}
              className="w-5 h-5 accent-[#1F5C4D] rounded cursor-pointer"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formSaving || uploadingPhoto}
              className="flex-1"
            >
              {formSaving ? "Saving..." : editingTeacher ? "Save Changes" : "Create Teacher"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Account Created & Setup Link Modal */}
      <BottomSheet
        open={setupLinkModalOpen}
        onClose={() => setSetupLinkModalOpen(false)}
        title="Teacher Account Created"
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-[#E6F0EC] border border-[#1F5C4D]/20 rounded text-xs text-[#1F5C4D]">
            <p className="font-semibold mb-1">Account provisioned successfully!</p>
            <p>
              An official Firebase password setup link was generated for <strong>{newTeacherName}</strong>.
            </p>
          </div>

          <Field id="teacher-setup-link" label="Password Setup Link" hint="You can copy this link and share it directly with the teacher:">
            <div className="flex items-center gap-2">
              <Input type="text" readOnly value={setupLink} className="text-xs font-mono" />
              <Button
                type="button"
                variant="secondary"
                onClick={copySetupLink}
                className="shrink-0 gap-1 text-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={2} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </Field>

          <Button
            type="button"
            variant="primary"
            onClick={() => setSetupLinkModalOpen(false)}
            className="w-full mt-2"
          >
            Done
          </Button>
        </div>
      </BottomSheet>

      {/* Status Deactivate / Activate Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(statusDialogTeacher)}
        title={statusDialogTeacher?.active ? "Deactivate Teacher" : "Activate Teacher"}
        description={
          statusDialogTeacher?.active
            ? `Deactivating ${statusDialogTeacher.name} will disable their login access and hide their profile from the public site. Their historical records and assigned classes will be kept safe.`
            : `Reactivating ${statusDialogTeacher?.name} will re-enable their login access and restore their public visibility.`
        }
        confirmLabel={
          statusToggling
            ? "Updating..."
            : statusDialogTeacher?.active
            ? "Deactivate Teacher"
            : "Activate Teacher"
        }
        cancelLabel="Cancel"
        variant={statusDialogTeacher?.active ? "danger" : "primary"}
        onConfirm={handleToggleStatus}
        onClose={() => setStatusDialogTeacher(null)}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onDismiss={() => setToastMessage("")}
        />
      )}
    </OwnerShell>
  );
}
