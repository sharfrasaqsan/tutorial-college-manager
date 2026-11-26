import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/public-data";
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Award,
  BookOpen,
  Users,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  return {
    title: college.name ? `${college.name} | Excellence in Tuition & Exam Preparation` : "Tutorial College",
    description:
      college.heroPromise ||
      "Dedicated tutorial college offering structured academic classes, experienced teachers, and proven examination results.",
  };
}

export default async function HomePage() {
  const { college, teachers, classes, activeYear } = await getPublicSiteData();
  const sections = college.sections || {
    showHero: true,
    showKeyFacts: true,
    showClasses: true,
    showTeacherStrip: true,
    showContactBlock: true,
  };

  // Group classes by grade
  const classesByGrade: Record<string, typeof classes> = {};
  classes.forEach((c) => {
    if (!classesByGrade[c.grade]) {
      classesByGrade[c.grade] = [];
    }
    classesByGrade[c.grade].push(c);
  });

  const sortedGrades = Object.keys(classesByGrade).sort();

  // WhatsApp & Phone formatting
  const cleanWa = (college.whatsappNumber || college.phone || "").replace(/[^0-9]/g, "");
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : "";
  const telUrl = college.phone ? `tel:${college.phone.replace(/\s+/g, "")}` : "";

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-12">
      {/* 1. Hero Section */}
      {sections.showHero && (
        <section className="bg-gradient-to-b from-[#E6F0EC]/60 to-transparent pt-12 pb-14 border-b border-[#E4E1DA]/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            {/* College Identity Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#E4E1DA] text-xs text-[#1F5C4D] font-medium mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#1F5C4D] animate-pulse"></span>
              <span>Academic Year {activeYear} Enrollment Open</span>
            </div>

            {/* College Logo (if uploaded) */}
            {college.logoUrl && (
              <div className="flex justify-center mb-5">
                <img
                  src={college.logoUrl}
                  alt={college.name}
                  className="w-16 h-16 object-contain rounded-lg shadow-sm"
                />
              </div>
            )}

            {/* College Name & Headline Promise */}
            <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-[#1C1F23] tracking-tight leading-[1.2] mb-5">
              {college.heroPromise ||
                `Welcome to ${college.name || "Tutorial College"}`}
            </h1>

            {/* Subtitle / Note */}
            <p className="text-sm sm:text-base text-[#5F6670] leading-relaxed max-w-2xl mx-auto mb-8">
              {college.heroSubtext ||
                college.aboutText ||
                "Providing structured subject coaching with passionate teachers who focus on conceptual understanding, past paper mastery, and disciplined exam preparation."}
            </p>

            {/* Clear Call and WhatsApp CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-sm font-medium text-[#FFFFFF] shadow-sm transition-all hover:shadow"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Inquire via WhatsApp</span>
                </a>
              )}

              {telUrl && (
                <a
                  href={telUrl}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[6px] bg-[#FFFFFF] hover:bg-[#FAF9F6] border border-[#E4E1DA] text-sm font-medium text-[#1C1F23] shadow-xs transition-all hover:border-[#1F5C4D]/40"
                >
                  <Phone className="w-4 h-4 text-[#1F5C4D]" />
                  <span>Call {college.phone || "Office"}</span>
                </a>
              )}

              <Link
                href="/classes"
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[6px] text-sm font-medium text-[#1F5C4D] hover:text-[#17473B] transition-colors"
              >
                <span>View Classes &amp; Fees</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 2. Key Facts Section */}
      {sections.showKeyFacts && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6670]">
                  Location &amp; Access
                </span>
                <div className="font-serif text-lg font-semibold text-[#1C1F23] mt-0.5">
                  {college.keyFacts?.location || college.address || "Convenient Central Location"}
                </div>
                <p className="text-xs text-[#5F6670] mt-1">
                  Easily accessible with safe transit links for attending students.
                </p>
              </div>
            </div>

            <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6670]">
                  Track Record
                </span>
                <div className="font-serif text-lg font-semibold text-[#1C1F23] mt-0.5">
                  {college.keyFacts?.yearsRunning || "Proven Teaching Excellence"}
                </div>
                <p className="text-xs text-[#5F6670] mt-1">
                  Consistent past paper focus and student support year after year.
                </p>
              </div>
            </div>

            <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6670]">
                  Academic Grades
                </span>
                <div className="font-serif text-lg font-semibold text-[#1C1F23] mt-0.5">
                  {college.keyFacts?.gradesTaught || "Middle School to A/L"}
                </div>
                <p className="text-xs text-[#5F6670] mt-1">
                  Tailored subject tracks designed for national examination syllabi.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Classes Preview by Grade */}
      {sections.showClasses && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 border-b border-[#E4E1DA] pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
                Curriculum &amp; Offerings
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C1F23] mt-1">
                Classes by Grade
              </h2>
            </div>
            <Link
              href="/classes"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1F5C4D] hover:underline"
            >
              <span>Explore all grade programs</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {sortedGrades.length === 0 ? (
            <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-8 text-center text-xs text-[#5F6670]">
              Current class batches are being finalized for Academic Year {activeYear}. Please contact the college office for schedules.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedGrades.slice(0, 6).map((grade) => (
                <div
                  key={grade}
                  className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-serif font-semibold text-lg text-[#1C1F23]">
                        {grade}
                      </span>
                      <span className="text-[11px] bg-[#E6F0EC] text-[#1F5C4D] px-2 py-0.5 rounded-[4px] font-medium">
                        {classesByGrade[grade].length} {classesByGrade[grade].length === 1 ? "Class" : "Classes"}
                      </span>
                    </div>

                    <ul className="divide-y divide-[#E4E1DA]/60 mb-4">
                      {classesByGrade[grade].slice(0, 3).map((cls) => (
                        <li key={cls.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-medium text-[#1C1F23]">{cls.subject}</span>
                            <div className="text-[11px] text-[#5F6670]">{cls.teacherName}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-[#1F5C4D]">
                              {cls.monthlyFee > 0
                                ? `LKR ${cls.monthlyFee.toLocaleString("en-LK")}`
                                : "Contact Office"}
                            </span>
                            <div className="text-[10px] text-[#5F6670]">/ month</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href={`/classes#${encodeURIComponent(grade)}`}
                    className="pt-3 border-t border-[#E4E1DA] text-xs font-medium text-[#1F5C4D] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all {grade} subjects &amp; timetable</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {college.admissionFeeNote && (
            <div className="mt-4 p-3 rounded-[6px] bg-[#E6F0EC]/60 border border-[#E4E1DA] text-xs text-[#5F6670] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1F5C4D] shrink-0" />
              <span>{college.admissionFeeNote}</span>
            </div>
          )}
        </section>
      )}

      {/* 4. Teacher Strip Section */}
      {sections.showTeacherStrip && teachers.length > 0 && (
        <section className="bg-[#FFFFFF] border-y border-[#E4E1DA] py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
                  Dedicated Educators
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C1F23] mt-1">
                  Teaching Faculty
                </h2>
              </div>
              <Link
                href="/teachers"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1F5C4D] hover:underline"
              >
                <span>View all faculty credentials</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {teachers.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  className="border border-[#E4E1DA] rounded-[6px] bg-[#FAF9F6] p-4 flex flex-col items-center text-center shadow-xs"
                >
                  {t.photoUrl ? (
                    <img
                      src={t.photoUrl}
                      alt={t.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#FFFFFF] shadow-sm mb-3"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-serif font-bold text-2xl mb-3">
                      {t.name.charAt(0)}
                    </div>
                  )}

                  <h3 className="font-serif font-semibold text-base text-[#1C1F23]">
                    {t.name}
                  </h3>

                  <div className="flex flex-wrap justify-center gap-1 mt-1 mb-2">
                    {t.subjects.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] bg-[#FFFFFF] border border-[#E4E1DA] text-[#5F6670] px-2 py-0.5 rounded-full font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {t.bio && (
                    <p className="text-xs text-[#5F6670] line-clamp-2 leading-relaxed">
                      {t.bio}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Contact & Campus Hours Block */}
      {sections.showContactBlock && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
                    Campus &amp; Admissions
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1C1F23] mt-1 mb-4">
                    Visit Us or Connect Today
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5F6670] leading-relaxed mb-6">
                    {college.aboutText ||
                      "Our administrative office is open for parent inquiries, student registrations, syllabus questions, and timetable consultations."}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#5F6670] mb-6">
                    {college.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-[#1C1F23]">Address</div>
                          <div>{college.address}</div>
                        </div>
                      </div>
                    )}

                    {college.openingHours && (
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-[#1C1F23]">Office &amp; Classroom Hours</div>
                          <div>{college.openingHours}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#E4E1DA]">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  )}

                  {telUrl && (
                    <a
                      href={telUrl}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] text-xs font-medium text-[#1C1F23] hover:bg-[#FAF9F6]"
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
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1F5C4D] hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Directions on Map</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Weekly Timetable Callout Card */}
              <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1F5C4D] uppercase tracking-wider mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>Weekly Class Schedule</span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-[#1C1F23] mb-2">
                    View Complete Timetable
                  </h3>
                  <p className="text-xs text-[#5F6670] leading-relaxed mb-4">
                    Check weekday and weekend class slots by grade level. All schedules follow fixed weekly timetables with zero surprise rescheduling.
                  </p>
                </div>

                <Link
                  href="/timetable"
                  className="inline-flex items-center justify-between w-full px-4 py-3 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] text-xs font-semibold text-[#1C1F23] hover:border-[#1F5C4D] hover:text-[#1F5C4D] transition-colors shadow-xs"
                >
                  <span>Open Printable Weekly Timetable</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
