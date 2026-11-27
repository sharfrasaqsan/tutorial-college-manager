"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone, MessageCircle, Menu, X, GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface PublicNavProps {
  collegeName: string;
  logoUrl?: string;
  phone?: string;
  whatsappNumber?: string;
}

export function PublicNav({
  collegeName,
  logoUrl,
  phone,
  whatsappNumber,
}: PublicNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/classes", label: "Classes & Fees" },
    { href: "/timetable", label: "Timetable" },
    { href: "/teachers", label: "Teachers" },
    { href: "/contact", label: "Contact & Visit" },
  ];

  // Clean WhatsApp URL
  const cleanWa = (whatsappNumber || phone || "").replace(/[^0-9]/g, "");
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}` : "";
  const telUrl = phone ? `tel:${phone.replace(/\s+/g, "")}` : "";

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E4E1DA] print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={collegeName}
              className="w-9 h-9 object-contain rounded-md"
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-lg">
              {collegeName.charAt(0) || "T"}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-[#1C1F23] text-base leading-tight tracking-tight">
              {collegeName || "Tutorial College"}
            </span>
            <span className="text-[10px] text-[#5F6670] uppercase tracking-wider font-medium">
              Academic Excellence
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#E6F0EC] text-[#1F5C4D]"
                    : "text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FFFFFF]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Call to Actions (Phone / WhatsApp) & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {telUrl && (
            <a
              href={telUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[#E4E1DA] bg-[#FFFFFF] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] transition-colors shadow-sm"
              aria-label="Call College"
            >
              <Phone className="w-3.5 h-3.5 text-[#1F5C4D]" />
              <span>Call Us</span>
            </a>
          )}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] transition-colors shadow-sm"
              aria-label="WhatsApp College"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-[6px] text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FFFFFF] border border-transparent hover:border-[#E4E1DA]"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E4E1DA] bg-[#FAF9F6] px-4 py-4 space-y-2 shadow-lg">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-[6px] text-sm font-medium ${
                    isActive
                      ? "bg-[#E6F0EC] text-[#1F5C4D]"
                      : "text-[#1C1F23] hover:bg-[#FFFFFF]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-[#E4E1DA] flex flex-col gap-2">
            <ThemeToggle variant="pill" className="w-full justify-center" />
            {telUrl && (
              <a
                href={telUrl}
                className="flex items-center justify-center gap-2 py-2.5 rounded-[6px] border border-[#E4E1DA] bg-[#FFFFFF] text-sm font-medium text-[#1C1F23]"
              >
                <Phone className="w-4 h-4 text-[#1F5C4D]" />
                <span>Call {phone}</span>
              </a>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-[6px] bg-[#1F5C4D] text-sm font-medium text-[#FFFFFF]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Message on WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
