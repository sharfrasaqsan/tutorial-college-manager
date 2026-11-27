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
  Eye,
  EyeOff,
  Globe,
  Key,
  ExternalLink,
  Share2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
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
  const [formPassword, setFormPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [formBio, setFormBio] = useState("");
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formShowOnPublic, setFormShowOnPublic] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Setup link & login modal after creation
  const [setupLinkModalOpen, setSetupLinkModalOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherCollege, setNewTeacherCollege] = useState("");
  const [newTeacherLoginUrl, setNewTeacherLoginUrl] = useState("");
  const [setupLink, setSetupLink] = useState("");
  const [emailStatusMessage, setEmailStatusMessage] = useState("");
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);

  // Status toggle dialog
  const [statusDialogTeacher, setStatusDialogTeacher] = useState<Teacher | null>(null);
  const [statusToggling, setStatusToggling] = useState(false);

  // Active academic year
  const [activeYear, setActiveYear] = useState<string>("");

  // Delete double-confirmation dialog states
  const [deleteStep1Teacher, setDeleteStep1Teacher] = useState<Teacher | null>(null);
  const [deleteStep2Teacher, setDeleteStep2Teacher] = useState<Teacher | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Read active year from cookie
    const match = document.cookie.match(/tcm_year=([^;]+)/);
    const initialYear = match?.[1] ? decodeURIComponent(match[1]) : "";
    if (initialYear) setActiveYear(initialYear);

    loadTeachers(initialYear);
    loadSubjects();

    const onYearChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ year?: string }>).detail;
      if (detail?.year) {
        setActiveYear(detail.year);
        loadTeachers(detail.year);
      }
    };
    window.addEventListener("tcm-year-changed", onYearChanged);
    return () => window.removeEventListener("tcm-year-changed", onYearChanged);
  }, []);

  async function loadTeachers(yearOverride?: string) {
    try {
      setLoading(true);
      const targetYear = yearOverride || activeYear;
      const url = targetYear
        ? `/api/owner/teachers?yearId=${encodeURIComponent(targetYear)}`
        : "/api/owner/teachers";
      const res = await fetch(url);
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
    setFormPassword("");
    setShowPasswordInput(false);
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
            password: formPassword.trim() || undefined,
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
          setNewTeacherEmail(formEmail.trim().toLowerCase());
          setNewTeacherPassword(data.tempPassword || formPassword.trim() || "");
          setSetupLink(data.resetLink || "");
          setNewTeacherCollege(data.collegeName || "Tutorial College");
          setNewTeacherLoginUrl(data.loginUrl || `${window.location.origin}/login`);
          setEmailDelivered(Boolean(data.emailDispatch?.delivered));
          setEmailStatusMessage(data.emailDispatch?.message || "");
          setShowCreatedPassword(false);
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

  async function handleConfirmDeleteTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteStep2Teacher) return;

    const input = deleteConfirmInput.trim().toLowerCase();
    const teacherName = deleteStep2Teacher.name.trim().toLowerCase();
    if (input !== "delete" && input !== teacherName) {
      showToast(`Please type "${deleteStep2Teacher.name}" or "DELETE" to confirm.`, "danger");
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/owner/teachers/${deleteStep2Teacher.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmText: deleteConfirmInput.trim(),
          yearId: activeYear || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(
          data.message || `${deleteStep2Teacher.name} was removed from academic year ${activeYear || ""}.`,
          "success"
        );
        setDeleteStep2Teacher(null);
        setDeleteConfirmInput("");
        loadTeachers();
      } else {
        showToast(data.error || "Failed to delete teacher.", "danger");
      }
    } catch {
      showToast("Server error while deleting teacher.", "danger");
    } finally {
      setDeleting(false);
    }
  }

  function copySetupLink() {
    navigator.clipboard.writeText(setupLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function copyPassword() {
    navigator.clipboard.writeText(newTeacherPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  }

  function copyEmail() {
    navigator.clipboard.writeText(newTeacherEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  function copyLoginUrl() {
    navigator.clipboard.writeText(newTeacherLoginUrl);
    setCopiedLoginUrl(true);
    setTimeout(() => setCopiedLoginUrl(false), 2000);
  }

  function copyAllDetails() {
    const text = `*${newTeacherCollege} App - Teacher Portal Access*\n\nHello ${newTeacherName},\nYour teacher account has been created in ${newTeacherCollege}.\n\nLogin Portal: ${newTeacherLoginUrl}\nEmail: ${newTeacherEmail}\nPassword: ${newTeacherPassword}\n\nSet your password directly:\n${setupLink}`;
    navigator.clipboard.writeText(text);
    setCopiedDetails(true);
    setTimeout(() => setCopiedDetails(false), 2500);
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
          pageSize={10}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="faculty members"
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
                  <button
                    type="button"
                    onClick={() => openEditSheet(teacher)}
                    title={`Edit ${teacher.name}`}
                    aria-label={`Edit ${teacher.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#E6F0EC] border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusDialogTeacher(teacher)}
                    title={teacher.active ? `Deactivate ${teacher.name}` : `Activate ${teacher.name}`}
                    aria-label={teacher.active ? `Deactivate ${teacher.name}` : `Activate ${teacher.name}`}
                    className={`w-8 h-8 rounded-md flex items-center justify-center border border-[#E4E1DA] transition-colors cursor-pointer ${
                      teacher.active
                        ? "text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] hover:border-[#A32A2A]/30"
                        : "text-[#1F5C4D] hover:bg-[#E6F0EC] hover:border-[#1F5C4D]/30"
                    }`}
                  >
                    {teacher.active ? (
                      <UserX className="w-3.5 h-3.5" strokeWidth={1.75} />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteStep1Teacher(teacher)}
                    title={`Delete ${teacher.name}`}
                    aria-label={`Delete ${teacher.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
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
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#E4E1DA]">
                <button
                  type="button"
                  onClick={() => openEditSheet(teacher)}
                  title={`Edit ${teacher.name}`}
                  aria-label={`Edit ${teacher.name}`}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#E6F0EC] border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  onClick={() => setStatusDialogTeacher(teacher)}
                  title={teacher.active ? `Deactivate ${teacher.name}` : `Activate ${teacher.name}`}
                  aria-label={teacher.active ? `Deactivate ${teacher.name}` : `Activate ${teacher.name}`}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border border-[#E4E1DA] transition-colors cursor-pointer ${
                    teacher.active
                      ? "text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] hover:border-[#A32A2A]/30"
                      : "text-[#1F5C4D] hover:bg-[#E6F0EC] hover:border-[#1F5C4D]/30"
                  }`}
                >
                  {teacher.active ? (
                    <UserX className="w-3.5 h-3.5" strokeWidth={1.75} />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteStep1Teacher(teacher)}
                  title={`Delete ${teacher.name}`}
                  aria-label={`Delete ${teacher.name}`}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
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

          {!editingTeacher && (
            <Field
              id="teacher-password"
              label="Initial Password (Optional)"
              hint="Leave blank to automatically generate a secure temporary password. An auto-email will be sent with login details."
            >
              <div className="relative">
                <Input
                  type={showPasswordInput ? "text" : "password"}
                  placeholder="Leave empty to auto-generate password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordInput(!showPasswordInput)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6670] hover:text-[#1C1F23] p-1"
                  aria-label={showPasswordInput ? "Hide password" : "Show password"}
                >
                  {showPasswordInput ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </Field>
          )}

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
        title="Teacher Account & Login Created"
      >
        <div className="flex flex-col gap-4">
          <div className="p-3.5 bg-[#E6F0EC] border border-[#1F5C4D]/25 rounded-[6px] text-xs text-[#1F5C4D]">
            <div className="flex items-center gap-2 font-semibold mb-1 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#1F5C4D] shrink-0" strokeWidth={2} />
              <span>Login Account Provisioned</span>
            </div>
            <p className="text-[#3A4048]">
              An official faculty account for <strong>{newTeacherName}</strong> was created in the <strong>{newTeacherCollege} App</strong>.
            </p>
          </div>

          {/* Email dispatch feedback */}
          {emailDelivered ? (
            <div className="p-3 bg-[#E6F0EC]/60 border border-[#1F5C4D]/20 rounded-[6px] text-xs text-[#1F5C4D] flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0 text-[#1F5C4D]" />
              <span>Automated welcome email sent to <strong>{newTeacherEmail}</strong>.</span>
            </div>
          ) : (
            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] text-xs text-[#5F6670] flex items-start gap-2">
              <Mail className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-[#1C1F23] block mb-0.5">Automated Email Dispatched</span>
                <span>Welcome email queued in system for <strong>{newTeacherEmail}</strong>. You can also share the login credentials below directly.</span>
              </div>
            </div>
          )}

          {/* Login Details Card */}
          <div className="space-y-3 p-3.5 rounded-[6px] border border-[#E4E1DA] bg-white">
            <div className="text-[11px] font-bold text-[#5F6670] uppercase tracking-wider">
              Faculty Login Credentials
            </div>

            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#5F6670] mb-1">
                <span>Email Address:</span>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="inline-flex items-center gap-1 text-[11px] text-[#1F5C4D] font-medium hover:underline cursor-pointer"
                >
                  {copiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEmail ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs font-mono font-medium text-[#1C1F23]">
                {newTeacherEmail}
              </div>
            </div>

            {/* Password Field */}
            {newTeacherPassword && (
              <div>
                <div className="flex items-center justify-between text-xs text-[#5F6670] mb-1">
                  <span>Initial Password:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#5F6670] hover:text-[#1C1F23] cursor-pointer"
                    >
                      {showCreatedPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showCreatedPassword ? "Hide" : "Show"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="inline-flex items-center gap-1 text-[11px] text-[#1F5C4D] font-medium hover:underline cursor-pointer"
                    >
                      {copiedPassword ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPassword ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs font-mono font-bold text-[#1F5C4D]">
                  {showCreatedPassword ? newTeacherPassword : "••••••••••••"}
                </div>
              </div>
            )}

            {/* Setup Link Field */}
            {setupLink && (
              <div>
                <div className="flex items-center justify-between text-xs text-[#5F6670] mb-1">
                  <span>Password Reset / Direct Link:</span>
                  <button
                    type="button"
                    onClick={copySetupLink}
                    className="inline-flex items-center gap-1 text-[11px] text-[#1F5C4D] font-medium hover:underline cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[11px] font-mono text-[#5F6670] truncate">
                  {setupLink}
                </div>
              </div>
            )}

            {/* Portal Link */}
            {newTeacherLoginUrl && (
              <div>
                <div className="flex items-center justify-between text-xs text-[#5F6670] mb-1">
                  <span>Portal Login URL:</span>
                  <button
                    type="button"
                    onClick={copyLoginUrl}
                    className="inline-flex items-center gap-1 text-[11px] text-[#1F5C4D] font-medium hover:underline cursor-pointer"
                  >
                    {copiedLoginUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLoginUrl ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs font-mono text-[#1C1F23] truncate">
                  {newTeacherLoginUrl}
                </div>
              </div>
            )}
          </div>

          {/* Quick Copy Full Details Button */}
          <Button
            type="button"
            variant="secondary"
            onClick={copyAllDetails}
            className="w-full gap-2 text-xs"
          >
            {copiedDetails ? (
              <>
                <Check className="w-4 h-4 text-[#1F5C4D]" strokeWidth={2} />
                <span>Copied All Login Details to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" strokeWidth={1.75} />
                <span>Copy Full Credentials (for WhatsApp / SMS)</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => setSetupLinkModalOpen(false)}
            className="w-full"
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

      {/* Delete Teacher - Step 1 Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteStep1Teacher)}
        onClose={() => setDeleteStep1Teacher(null)}
        onConfirm={() => {
          const target = deleteStep1Teacher;
          setDeleteStep1Teacher(null);
          setDeleteConfirmInput("");
          setDeleteStep2Teacher(target);
        }}
        title={`Delete Teacher from ${activeYear || "Academic Year"}: ${deleteStep1Teacher?.name || ""}?`}
        description={`This will remove ${deleteStep1Teacher?.name || "this teacher"} from ${activeYear ? `Academic Year ${activeYear}` : "the current academic year"} and future activities. Their historical data in past academic years (e.g. 2025) and completed sessions will remain safely preserved and will NOT be modified. To proceed, confirm in the next step.`}
        confirmLabel="Continue to Final Confirmation"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Delete Teacher - Step 2 Final Typed Double Confirmation */}
      <BottomSheet
        open={Boolean(deleteStep2Teacher)}
        onClose={() => {
          if (!deleting) {
            setDeleteStep2Teacher(null);
            setDeleteConfirmInput("");
          }
        }}
        title="Final Delete Confirmation"
        description={`Type "${deleteStep2Teacher?.name || ""}" or "DELETE" below to confirm deletion for ${activeYear ? `Academic Year ${activeYear}` : "current academic year"}.`}
      >
        <form onSubmit={handleConfirmDeleteTeacher} className="flex flex-col gap-4 py-1">
          <div className="p-3.5 rounded-[6px] bg-[#FBE9E7]/80 border border-[#A32A2A]/30 flex items-start gap-2.5 text-xs text-[#A32A2A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <strong className="block mb-0.5 text-sm">
                Scoped to {activeYear ? `Academic Year ${activeYear}` : "Current Year"} &amp; Future Only
              </strong>
              <span>
                <strong>{deleteStep2Teacher?.name}</strong> will be unassigned from active classes and future scheduled sessions in {activeYear || "this year"}, and their login account will be terminated. All past academic years and completed session records will remain safely preserved in the database.
              </span>
            </div>
          </div>

          <Field
            id="confirmDeleteTeacherInput"
            label={`Type "${deleteStep2Teacher?.name || ""}" or "DELETE" to confirm:`}
            required
          >
            <Input
              type="text"
              placeholder={deleteStep2Teacher?.name || "DELETE"}
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              disabled={deleting}
              autoFocus
              className="font-mono text-xs"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteStep2Teacher(null);
                setDeleteConfirmInput("");
              }}
              disabled={deleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                deleting ||
                (deleteConfirmInput.trim().toLowerCase() !== "delete" &&
                  deleteConfirmInput.trim().toLowerCase() !==
                    (deleteStep2Teacher?.name || "").trim().toLowerCase())
              }
              loading={deleting}
              className="flex-1"
            >
              Permanently Delete
            </Button>
          </div>
        </form>
      </BottomSheet>

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
