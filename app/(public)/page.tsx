import React from "react";
import Link from "next/link";

export default function PublicPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1C1F23] flex flex-col justify-between p-6 max-w-md mx-auto">
      <header className="pt-8">
        <span className="text-xs font-semibold tracking-wider uppercase text-[#1F5C4D]">
          Tutorial College
        </span>
        <h1 className="font-serif text-3xl font-semibold text-[#1C1F23] mt-2">
          Knowledge College
        </h1>
        <p className="text-xs text-[#5F6670] mt-1">
          Colombo, Sri Lanka • Academic Year 2026
        </p>
      </header>

      <main className="my-auto py-8">
        <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-5">
          <h2 className="text-sm font-semibold text-[#1C1F23]">Public Portal</h2>
          <p className="text-xs text-[#5F6670] mt-1 leading-relaxed">
            Parents and visitors can view class schedules, monthly fee structures, and faculty credentials.
          </p>
        </div>
      </main>

      <footer className="pb-6 border-t border-[#E4E1DA] pt-4 flex flex-col gap-2">
        <div className="flex justify-between text-xs text-[#5F6670]">
          <Link href="/owner" className="hover:text-[#1F5C4D]">Owner Portal</Link>
          <Link href="/teacher" className="hover:text-[#1F5C4D]">Teacher Portal</Link>
          <Link href="/design" className="hover:text-[#1F5C4D]">Design System</Link>
        </div>
      </footer>
    </div>
  );
}
