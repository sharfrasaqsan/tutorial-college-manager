import React from "react";
import type { Metadata } from "next";
import { getPublicSiteData } from "@/lib/public-data";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  return {
    title: `Contact & Campus Location | ${college.name || "Tutorial College"}`,
    description:
      "Contact information, administrative office hours, campus address, and location map directions for admissions and inquiries.",
  };
}

export default async function ContactPage() {
  const { college } = await getPublicSiteData();

  const cleanWa = (college.whatsappNumber || college.phone || "").replace(/[^0-9]/g, "");
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : "";
  const telUrl = college.phone ? `tel:${college.phone.replace(/\s+/g, "")}` : "";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="max-w-2xl mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Admissions &amp; General Inquiries
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1C1F23] mt-1.5 mb-3">
          Contact &amp; Campus Location
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6670] leading-relaxed">
          We welcome parents and students to visit our campus during office hours for course consultations, timetable reviews, and enrollment registrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Direct Contact Info & Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 sm:p-8 shadow-xs">
            <h2 className="font-serif text-2xl font-semibold text-[#1C1F23] mb-6">
              College Administrative Office
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-[#5F6670]">
              {/* Address */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-[#1C1F23] text-sm mb-0.5">Campus Address</div>
                  <div className="leading-relaxed">{college.address || "Colombo, Sri Lanka"}</div>
                  {college.mapUrl && (
                    <a
                      href={college.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#1F5C4D] hover:underline mt-2 font-medium"
                    >
                      <span>Open Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Telephone */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-[#1C1F23] text-sm mb-0.5">Phone Line</div>
                  <div className="leading-relaxed">
                    {college.phone ? (
                      <a href={`tel:${college.phone}`} className="hover:text-[#1C1F23]">
                        {college.phone}
                      </a>
                    ) : (
                      "Not available"
                    )}
                  </div>
                  <div className="text-[11px] text-[#5F6670] mt-1">Available during office hours</div>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-[#1C1F23] text-sm mb-0.5">Email Inquiries</div>
                  <div className="leading-relaxed">
                    {college.email ? (
                      <a href={`mailto:${college.email}`} className="hover:text-[#1C1F23]">
                        {college.email}
                      </a>
                    ) : (
                      "info@tutorialcollege.lk"
                    )}
                  </div>
                  <div className="text-[11px] text-[#5F6670] mt-1">Written replies within 24 hours</div>
                </div>
              </div>

              {/* Opening Hours */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-[#1C1F23] text-sm mb-0.5">Office &amp; Teaching Hours</div>
                  <div className="leading-relaxed">
                    {college.openingHours || "Mon - Sat: 08:00 AM - 06:00 PM, Sun: 08:00 AM - 01:00 PM"}
                  </div>
                  <div className="text-[11px] text-[#5F6670] mt-1">Timezone: Asia/Colombo</div>
                </div>
              </div>
            </div>

            {/* Direct Instant Action Buttons */}
            <div className="mt-8 pt-6 border-t border-[#E4E1DA] flex flex-wrap items-center gap-3">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Start WhatsApp Conversation</span>
                </a>
              )}

              {telUrl && (
                <a
                  href={telUrl}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] text-xs font-medium text-[#1C1F23] hover:bg-[#FAF9F6] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#1F5C4D]" />
                  <span>Call {college.phone}</span>
                </a>
              )}

              {college.mapUrl && (
                <a
                  href={college.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[6px] border border-[#E4E1DA] text-xs font-medium text-[#1F5C4D] hover:bg-[#E6F0EC]/50 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Get Driving Directions</span>
                </a>
              )}
            </div>
          </div>

          {/* About / Institutional Statement */}
          {college.aboutText && (
            <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 shadow-xs">
              <h3 className="font-serif font-semibold text-lg text-[#1C1F23] mb-2">
                About {college.name || "Our Institution"}
              </h3>
              <p className="text-xs text-[#5F6670] leading-relaxed">
                {college.aboutText}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Admission Guidelines & Visiting Notice */}
        <div className="space-y-6">
          <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FAF9F6] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1F5C4D] uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Visiting Guidelines</span>
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1C1F23] mb-3">
              Registration &amp; Enrollment
            </h3>
            <ul className="space-y-2.5 text-xs text-[#5F6670] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D] mt-1.5 shrink-0"></span>
                <span>Parents may visit the college counter during working hours to complete student enrollment forms.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D] mt-1.5 shrink-0"></span>
                <span>Please bring the student&apos;s most recent school examination report card for subject level placement.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D] mt-1.5 shrink-0"></span>
                <span>Tuition fees and one-time admission fees can be settled directly in cash or bank transfer at the administrative desk.</span>
              </li>
            </ul>
          </div>

          <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 shadow-xs">
            <h3 className="font-serif text-base font-semibold text-[#1C1F23] mb-2">
              Online Assistance
            </h3>
            <p className="text-xs text-[#5F6670] leading-relaxed mb-4">
              Need immediate answers regarding timetable clashes or syllabus coverage? Our WhatsApp line connects directly with the admissions officer.
            </p>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-[6px] bg-[#E6F0EC] hover:bg-[#D8E8E1] text-xs font-semibold text-[#1F5C4D] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Message Admissions Desk</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
