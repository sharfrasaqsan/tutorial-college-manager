"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "pill";
}

export function ThemeToggle({ className = "", variant = "icon" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("tcm_theme", nextTheme);
      document.cookie = `tcm_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  // Before hydration, render a clean placeholder matching the button footprint
  if (!mounted) {
    if (variant === "pill") {
      return (
        <div
          className={`h-8 px-3 rounded-[6px] border border-[#E4E1DA] bg-[#FAF9F6] opacity-0 ${className}`}
          aria-hidden="true"
        />
      );
    }
    return (
      <div
        className={`w-9 h-9 rounded-[6px] opacity-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#E4E1DA] bg-[#FFFFFF] text-[#1C1F23] hover:bg-[#FAF9F6] transition-colors cursor-pointer select-none ${className}`}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? (
          <>
            <Sun className="w-3.5 h-3.5 text-[#FBBF24]" strokeWidth={2} />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={2} />
            <span>Dark Mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6] rounded-[6px] transition-colors cursor-pointer select-none ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-[#FBBF24] transition-transform duration-200 rotate-0 hover:rotate-45" strokeWidth={2} />
      ) : (
        <Moon className="w-4 h-4 text-[#5F6670] transition-transform duration-200 rotate-0 hover:-rotate-12" strokeWidth={2} />
      )}
    </button>
  );
}
