import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSiteData } from "@/lib/public-data";
import { PublicNav } from "@/components/public/PublicNav";
import { MapPin, Phone, Mail, Clock, ArrowRight, ShieldCheck } from "lucide-react";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  const title = college.name ? `${college.name} | Colombo Tutorial College` : "Tutorial College | Colombo";
  const description =
    college.heroPromise ||
    college.aboutText ||
    "A premier tutorial college dedicated to academic excellence in Sri Lanka.";

  return {
    title: {
      default: title,
      template: `%s | ${college.name || "Tutorial College"}`,
    },
    description,
    keywords: [
      "tutorial college",
      "tuition classes",
      "Colombo tuition",
      "Sri Lanka O/L",
      "Sri Lanka A/L",
      "revision classes",
      "mathematics tuition",
      "science tuition",
      college.name,
    ],
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_LK",
      siteName: college.name,
      images: college.logoUrl ? [{ url: college.logoUrl }] : [],
    },
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { college } = await getPublicSiteData();

  // Clean JSON-LD for an EducationalOrganization
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: college.name || "Tutorial College",
    description: college.heroPromise || college.aboutText || "Tutorial College in Sri Lanka",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://tutorialcollege.lk",
    logo: college.logoUrl || undefined,
    telephone: college.phone || undefined,
    email: college.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: college.address || "Colombo",
      addressLocality: "Colombo",
      addressCountry: "LK",
    },
    openingHours: college.openingHours || undefined,
    priceRange: "LKR",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1C1F23]">
      {/* Structured Data JSON-LD for Google & SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Main Public Navigation */}
      <PublicNav
        collegeName={college.name}
        logoUrl={college.logoUrl}
        phone={college.phone}
        whatsappNumber={college.whatsappNumber}
      />

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Warm, Trustworthy Public Footer */}
      <footer className="border-t border-[#E4E1DA] bg-[#FFFFFF] mt-16 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Column 1: College Identity */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                {college.logoUrl ? (
                  <img
                    src={college.logoUrl}
                    alt={college.name}
                    className="w-8 h-8 object-contain rounded-md"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-sm">
                    {college.name.charAt(0) || "T"}
                  </div>
                )}
                <span className="font-serif font-semibold text-lg text-[#1C1F23]">
                  {college.name || "Tutorial College"}
                </span>
              </div>
              <p className="text-xs text-[#5F6670] leading-relaxed max-w-md">
                {college.aboutText ||
                  college.heroPromise ||
                  "A disciplined learning environment committed to building confident students and exceptional academic results in national curricula."}
              </p>
              {college.keyFacts?.yearsRunning && (
                <div className="inline-flex items-center gap-1.5 text-xs text-[#1F5C4D] bg-[#E6F0EC] px-2.5 py-1 rounded-[4px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{college.keyFacts.yearsRunning}</span>
                </div>
              )}
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C1F23] mb-3">
                Information
              </h3>
              <ul className="space-y-2 text-xs text-[#5F6670]">
                <li>
                  <Link href="/classes" className="hover:text-[#1F5C4D] transition-colors">
                    Classes &amp; Monthly Fees
                  </Link>
                </li>
                <li>
                  <Link href="/timetable" className="hover:text-[#1F5C4D] transition-colors">
                    Weekly Timetable
                  </Link>
                </li>
                <li>
                  <Link href="/teachers" className="hover:text-[#1F5C4D] transition-colors">
                    Teaching Faculty
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-[#1F5C4D] transition-colors">
                    Campus Location &amp; Hours
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C1F23] mb-3">
                Contact &amp; Campus
              </h3>
              <ul className="space-y-2.5 text-xs text-[#5F6670]">
                {college.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
                    <span>{college.address}</span>
                  </li>
                )}
                {college.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0" />
                    <a href={`tel:${college.phone}`} className="hover:text-[#1C1F23]">
                      {college.phone}
                    </a>
                  </li>
                )}
                {college.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0" />
                    <a href={`mailto:${college.email}`} className="hover:text-[#1C1F23]">
                      {college.email}
                    </a>
                  </li>
                )}
                {college.openingHours && (
                  <li className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0 mt-0.5" />
                    <span>{college.openingHours}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Sub-footer: Copyright & Staff Links */}
          <div className="pt-8 mt-8 border-t border-[#E4E1DA] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5F6670]">
            <div>
              &copy; {new Date().getFullYear()} {college.name || "Tutorial College"}. All rights reserved. English • Currency LKR • Asia/Colombo.
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <Link href="/owner" className="hover:text-[#1C1F23]">
                Owner Portal
              </Link>
              <span className="text-[#E4E1DA]">&bull;</span>
              <Link href="/teacher" className="hover:text-[#1C1F23]">
                Teacher Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
