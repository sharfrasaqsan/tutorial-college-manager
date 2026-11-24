"use client";

import React, { useState, useEffect } from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BookOpen,
  GraduationCap,
  Users,
  Phone,
  Search,
  ChevronDown,
  ChevronUp,
  School,
  UserCheck,
} from "lucide-react";

interface EnrolledStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  guardianName: string;
  guardianPhone: string;
  joinedMonth: string;
}

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  subject: string;
  active: boolean;
  studentCount: number;
  students: EnrolledStudent[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const res = await fetch("/api/teacher/classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes || []);
          if (data.classes?.length > 0) {
            setExpandedClassId(data.classes[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load teacher classes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  const filteredClasses = classes.map((cls) => {
    if (!search.trim()) return cls;
    const q = search.toLowerCase();
    const matchingStudents = cls.students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.school.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q) ||
        s.guardianPhone.includes(q)
    );
    return {
      ...cls,
      students: matchingStudents,
    };
  });

  return (
    <TeacherShell pageTitle="My Classes" maxWidth="wide">
      <PageHeader
        title="My Classes &amp; Students"
        subtitle="View enrolled student rosters, schools and guardian contact numbers"
      />

      {/* Search Input */}
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search students by name, school or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
          title="No classes assigned"
          description="You do not have any classes assigned for this academic year yet. The college owner assigns faculty to classes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {filteredClasses.map((cls) => {
            const isExpanded = expandedClassId === cls.id;

            return (
              <Card
                key={cls.id}
                className={`p-0 overflow-hidden border border-[#E4E1DA] bg-white transition-all ${
                  isExpanded ? "md:col-span-2 xl:col-span-3 ring-1 ring-[#1F5C4D]/30" : ""
                }`}
              >
                {/* Class Header Bar */}
                <button
                  type="button"
                  onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[#FAF9F6] transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                      <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[#1C1F23]">{cls.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-[#5F6670] mt-0.5">
                        <span>{cls.grade}</span>
                        <span>•</span>
                        <span>{cls.studentCount} enrolled students</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#5F6670]">
                    <span>{isExpanded ? "Hide Roster" : "View Roster"}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <ChevronDown className="w-4 h-4" strokeWidth={2} />
                    )}
                  </div>
                </button>

                {/* Enrolled Students Roster */}
                {isExpanded && (
                  <div className="border-t border-[#E4E1DA] bg-[#FAF9F6]">
                    {cls.students.length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#5F6670]">
                        {search ? "No matching students found." : "No students enrolled in this class yet."}
                      </div>
                    ) : (
                      <>
                        {/* DESKTOP TABLE VIEW (>=1024px) */}
                        <div className="hidden lg:block bg-white overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5F6670] uppercase font-bold text-[10px] tracking-wider">
                                <th className="py-3 px-4 w-12 text-center">#</th>
                                <th className="py-3 px-4">Student Name</th>
                                <th className="py-3 px-4">School</th>
                                <th className="py-3 px-4">Guardian Name</th>
                                <th className="py-3 px-4 text-right">Guardian Phone</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E1DA]">
                              {cls.students.map((student, idx) => (
                                <tr key={student.id} className="hover:bg-[#FAF9F6]/60 transition-colors">
                                  <td className="py-3 px-4 text-center font-mono text-[#5F6670] tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-[#1C1F23]">
                                    {student.name}
                                  </td>
                                  <td className="py-3 px-4 text-[#5F6670]">
                                    {student.school || "—"}
                                  </td>
                                  <td className="py-3 px-4 text-[#1C1F23]">
                                    {student.guardianName || "—"}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {student.guardianPhone ? (
                                      <a
                                        href={`tel:${student.guardianPhone}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[#E6F0EC] text-[#1F5C4D] hover:bg-[#d8e8e1] font-semibold text-xs tabular-nums transition-colors"
                                        title={`Call Guardian ${student.guardianName}`}
                                      >
                                        <Phone className="w-3 h-3" strokeWidth={2} />
                                        <span>{student.guardianPhone}</span>
                                      </a>
                                    ) : (
                                      <span className="text-[#5F6670]">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* MOBILE & TABLET CARD VIEW (<1024px) */}
                        <div className="block lg:hidden p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {cls.students.map((student, idx) => (
                              <div
                                key={student.id}
                                className="bg-white p-3 rounded-[6px] border border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-[#5F6670] w-5 tabular-nums">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-semibold text-xs text-[#1C1F23]">
                                      {student.name}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5F6670] mt-1 pl-7">
                                    {student.school && (
                                      <div className="flex items-center gap-1">
                                        <School className="w-3 h-3" strokeWidth={1.75} />
                                        <span>{student.school}</span>
                                      </div>
                                    )}
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                      <UserCheck className="w-3 h-3" strokeWidth={1.75} />
                                      <span>Guardian: {student.guardianName}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Guardian Phone Tap-to-Call */}
                                {student.guardianPhone && (
                                  <div className="pl-7 sm:pl-0 shrink-0">
                                    <a
                                      href={`tel:${student.guardianPhone}`}
                                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] hover:bg-[#d8e8e1] font-semibold text-xs tabular-nums transition-colors"
                                      title={`Call Guardian ${student.guardianName}`}
                                    >
                                      <Phone className="w-3.5 h-3.5" strokeWidth={2} />
                                      <span>{student.guardianPhone}</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </TeacherShell>
  );
}
