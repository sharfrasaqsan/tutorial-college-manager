import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/public-data";
import { Users, BookOpen, MessageCircle, Phone, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  return {
    title: `Teaching Faculty | ${college.name || "Tutorial College"}`,
    description:
      "Meet our dedicated educators and subject specialists with proven track records in G.C.E. O/L and A/L examinations in Sri Lanka.",
  };
}

export default async function TeachersPage() {
  const { college, teachers } = await getPublicSiteData();

  const cleanWa = (college.whatsappNumber || college.phone || "").replace(/[^0-9]/g, "");
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : "";
  const telUrl = college.phone ? `tel:${college.phone.replace(/\s+/g, "")}` : "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="max-w-2xl mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Academic Staff
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1C1F23] mt-1.5 mb-3">
          Our Teaching Faculty
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6670] leading-relaxed">
          Passionate educators who simplify complex concepts, conduct focused past paper discussions, and guide students with individual attention.
        </p>
      </div>

      {/* Teachers Showcase Grid */}
      {teachers.length === 0 ? (
        <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-12 text-center text-xs text-[#5F6670]">
          <Users className="w-8 h-8 text-[#5F6670]/60 mx-auto mb-3" />
          <p className="font-medium text-[#1C1F23]">Faculty profiles are being updated</p>
          <p className="mt-1">
            Teacher assignments for the current academic session will appear here shortly.
          </p>
          {telUrl && (
            <a
              href={telUrl}
              className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-[#1F5C4D] hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contact Admissions Desk ({college.phone})</span>
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-4 mb-4">
                  {teacher.photoUrl ? (
                    <img
                      src={teacher.photoUrl}
                      alt={teacher.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#E6F0EC] shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-serif font-bold text-xl shrink-0">
                      {teacher.name.charAt(0)}
                    </div>
                  )}

                  <div>
                    <h2 className="font-serif font-semibold text-lg text-[#1C1F23]">
                      {teacher.name}
                    </h2>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {teacher.subjects.map((sub) => (
                        <span
                          key={sub}
                          className="text-[10px] bg-[#FAF9F6] border border-[#E4E1DA] text-[#5F6670] px-2 py-0.5 rounded-full font-medium"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E4E1DA]/60 pt-3">
                  <p className="text-xs text-[#5F6670] leading-relaxed">
                    {teacher.bio ||
                      "Experienced subject instructor dedicated to thorough syllabus coverage, structured revision notes, and exam paper guidance."}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-[#E4E1DA] flex items-center justify-between text-xs">
                <Link
                  href="/classes"
                  className="inline-flex items-center gap-1 text-[#1F5C4D] hover:underline font-medium"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>View Classes Taught</span>
                </Link>

                {waUrl && (
                  <a
                    href={`${waUrl}?text=${encodeURIComponent(`Hello, I would like to inquire about classes taught by ${teacher.name}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#5F6670] hover:text-[#1C1F23]"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#1F5C4D]" />
                    <span>Inquire</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Philosophy Banner */}
      <div className="mt-16 border border-[#E4E1DA] rounded-[6px] bg-[#E6F0EC]/60 p-6 sm:p-8 flex items-start gap-4">
        <Award className="w-6 h-6 text-[#1F5C4D] shrink-0 mt-1" />
        <div className="text-xs text-[#1C1F23] space-y-1">
          <div className="font-serif font-semibold text-base">
            Teaching Ethics &amp; Student Welfare
          </div>
          <p className="text-[#5F6670] leading-relaxed">
            Every teacher at {college.name || "our college"} follows a structured monthly curriculum with compulsory homework reviews and exam practice. For teacher privacy and safeguarding, personal phone and email addresses are retained internally and direct parent coordination is handled through the administrative office.
          </p>
        </div>
      </div>
    </div>
  );
}
