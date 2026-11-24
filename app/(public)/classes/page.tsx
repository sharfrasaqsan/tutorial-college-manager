import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/public-data";
import {
  BookOpen,
  User,
  ShieldCheck,
  Phone,
  MessageCircle,
  HelpCircle,
  Calendar,
} from "lucide-react";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  return {
    title: `Classes & Monthly Fees | ${college.name || "Tutorial College"}`,
    description:
      "Explore tutorial classes by grade level, subjects, specialist teachers, and transparent monthly fee structures in LKR.",
  };
}

export default async function ClassesPage() {
  const { college, classes, activeYear } = await getPublicSiteData();

  // Group classes by grade
  const classesByGrade: Record<string, typeof classes> = {};
  classes.forEach((c) => {
    if (!classesByGrade[c.grade]) {
      classesByGrade[c.grade] = [];
    }
    classesByGrade[c.grade].push(c);
  });

  const sortedGrades = Object.keys(classesByGrade).sort();

  const cleanWa = (college.whatsappNumber || college.phone || "").replace(/[^0-9]/g, "");
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : "";
  const telUrl = college.phone ? `tel:${college.phone.replace(/\s+/g, "")}` : "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="max-w-2xl mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Academic Year {activeYear}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1C1F23] mt-1.5 mb-3">
          Classes &amp; Monthly Fees
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6670] leading-relaxed">
          Clear and transparent tuition fees in Sri Lankan Rupees (LKR). All classes are conducted weekly with comprehensive revision and exam papers.
        </p>
      </div>

      {/* Admission Fee Note Banner */}
      {college.admissionFeeNote && (
        <div className="mb-10 p-4 rounded-[6px] bg-[#E6F0EC] border border-[#E4E1DA] flex items-start gap-3 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-[#1F5C4D] shrink-0 mt-0.5" />
          <div className="text-xs text-[#1C1F23]">
            <span className="font-semibold text-[#1F5C4D]">Admission &amp; Registration: </span>
            <span>{college.admissionFeeNote}</span>
          </div>
        </div>
      )}

      {/* Grade Selector Pills (Sticky on desktop) */}
      {sortedGrades.length > 0 && (
        <div className="sticky top-16 z-20 bg-[#FAF9F6]/95 backdrop-blur-xs flex flex-wrap items-center gap-2 mb-8 py-3 border-b border-[#E4E1DA]">
          <span className="text-xs font-medium text-[#5F6670] mr-2">Jump to grade:</span>
          {sortedGrades.map((grade) => (
            <a
              key={grade}
              href={`#${encodeURIComponent(grade)}`}
              className="px-3 py-1 rounded-[4px] bg-[#FFFFFF] border border-[#E4E1DA] hover:border-[#1F5C4D] text-xs font-medium text-[#1C1F23] hover:text-[#1F5C4D] transition-colors shadow-2xs"
            >
              {grade}
            </a>
          ))}
        </div>
      )}

      {/* Classes Listed by Grade */}
      {sortedGrades.length === 0 ? (
        <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-12 text-center text-xs text-[#5F6670]">
          <BookOpen className="w-8 h-8 text-[#5F6670]/60 mx-auto mb-3" />
          <p className="font-medium text-[#1C1F23]">No active classes scheduled yet</p>
          <p className="mt-1">
            New batches for Academic Year {activeYear} are currently being published. Please contact the college office directly for inquiries.
          </p>
          {telUrl && (
            <a
              href={telUrl}
              className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-[#1F5C4D] hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call {college.phone}</span>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {sortedGrades.map((grade) => (
            <section key={grade} id={encodeURIComponent(grade)} className="scroll-mt-24">
              <div className="flex items-center justify-between border-b border-[#E4E1DA] pb-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-2xl font-semibold text-[#1C1F23]">
                    {grade}
                  </h2>
                  <span className="text-xs text-[#5F6670]">
                    ({classesByGrade[grade].length} {classesByGrade[grade].length === 1 ? "Subject" : "Subjects"})
                  </span>
                </div>
                <Link
                  href={`/timetable?grade=${encodeURIComponent(grade)}`}
                  className="inline-flex items-center gap-1 text-xs text-[#1F5C4D] hover:underline font-medium"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>View timetable</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classesByGrade[grade].map((cls) => (
                  <div
                    key={cls.id}
                    className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-serif font-semibold text-lg text-[#1C1F23]">
                          {cls.subject}
                        </h3>
                        <span className="text-[11px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded-[4px]">
                          {cls.monthlyFee > 0
                            ? `LKR ${cls.monthlyFee.toLocaleString("en-LK")}`
                            : "Contact"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#5F6670] mb-4">
                        <User className="w-3.5 h-3.5 text-[#1F5C4D]" />
                        <span>Teacher: <strong className="text-[#1C1F23] font-medium">{cls.teacherName}</strong></span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E4E1DA]/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#5F6670]">Tuition payable monthly</span>
                      {waUrl && (
                        <a
                          href={`${waUrl}?text=${encodeURIComponent(`Hello, I would like to inquire about enrolling in ${grade} - ${cls.subject} with ${cls.teacherName}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#1F5C4D] hover:underline font-medium"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Inquire</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Parent Help & Registration Section */}
      <div className="mt-16 border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h3 className="font-serif text-xl font-semibold text-[#1C1F23] mb-1">
            Questions About Enrollment or Subject Packages?
          </h3>
          <p className="text-xs text-[#5F6670] leading-relaxed max-w-xl">
            Our office is available to advise on multi-subject discounts, timetable compatibility, and syllabi coverage for your child.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Admission Desk</span>
            </a>
          )}
          {telUrl && (
            <a
              href={telUrl}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] text-xs font-medium text-[#1C1F23] hover:bg-[#FAF9F6]"
            >
              <Phone className="w-3.5 h-3.5 text-[#1F5C4D]" />
              <span>Call Office</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
