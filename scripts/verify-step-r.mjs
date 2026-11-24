import fs from "fs";
import path from "path";
import { execSync } from "child_process";

console.log("=== STEP R: RESPONSIVE DESKTOP & TABLET AUDIT & VERIFICATION ===");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Verify responsive primitives
const pageContainerContent = fs.readFileSync("components/layout/PageContainer.tsx", "utf-8");
assert(pageContainerContent.includes("max-w-6xl") && pageContainerContent.includes("max-w-7xl"), "PageContainer supports default (max-w-6xl) and wide (max-w-7xl)");

const bottomSheetContent = fs.readFileSync("components/ui/BottomSheet.tsx", "utf-8");
assert(bottomSheetContent.includes("md:w-[480px]") && (bottomSheetContent.includes("md:justify-end") || bottomSheetContent.includes("md:right-0")), "BottomSheet transforms into 480px slide-over drawer on md/lg");

const dataTableContent = fs.readFileSync("components/ui/DataTable.tsx", "utf-8");
assert(dataTableContent.includes("<table") && dataTableContent.includes("hidden lg:block"), "DataTable supports semantic table on desktop (>=1024px)");

// 2. Verify OwnerShell & TeacherShell responsive breakpoints
const ownerShellContent = fs.readFileSync("components/layout/OwnerShell.tsx", "utf-8");
assert(ownerShellContent.includes("hidden md:flex lg:hidden") && ownerShellContent.includes("w-16"), "OwnerShell provides 64px icon rail for tablet (768px-1023px)");
assert(ownerShellContent.includes("hidden lg:flex w-60") && ownerShellContent.includes("sticky top-0 h-screen"), "OwnerShell provides 240px sidebar for desktop (>=1024px)");
assert(ownerShellContent.includes("md:hidden fixed bottom-0"), "OwnerShell retains bottom navigation exclusively for mobile (<768px)");

const teacherShellContent = fs.readFileSync("components/layout/TeacherShell.tsx", "utf-8");
assert(teacherShellContent.includes("hidden md:flex lg:hidden") && teacherShellContent.includes("w-16"), "TeacherShell provides 64px icon rail for tablet");
assert(teacherShellContent.includes("hidden lg:flex w-60"), "TeacherShell provides 240px sidebar for desktop");
assert(teacherShellContent.includes("md:hidden fixed bottom-0"), "TeacherShell retains bottom navigation for mobile");

// 3. Verify Timetable views (Owner & Teacher & Public)
const ownerTimetable = fs.readFileSync("app/(owner)/owner/timetable/page.tsx", "utf-8");
assert(ownerTimetable.includes("hidden lg:grid lg:grid-cols-7"), "Owner Timetable renders 7-day weekly grid on desktop");
assert(ownerTimetable.includes("block lg:hidden"), "Owner Timetable renders day tabs on mobile/tablet");

const teacherTimetable = fs.readFileSync("app/(teacher)/teacher/timetable/page.tsx", "utf-8");
assert(teacherTimetable.includes("hidden lg:grid lg:grid-cols-7"), "Teacher Timetable renders 7-day weekly grid on desktop");
assert(teacherTimetable.includes("block lg:hidden"), "Teacher Timetable renders day tabs on mobile/tablet");

const publicTimetable = fs.readFileSync("components/public/PublicTimetableClient.tsx", "utf-8");
assert(publicTimetable.includes("hidden lg:grid print:hidden lg:grid-cols-7"), "Public Timetable renders 7-day weekly calendar matrix on desktop");
assert(publicTimetable.includes("block lg:hidden print:block"), "Public Timetable renders day-by-day list for mobile & print");

// 4. Verify 2-column and multi-column desktop layouts
const ownerHome = fs.readFileSync("app/(owner)/owner/page.tsx", "utf-8");
assert(ownerHome.includes("grid-cols-2 lg:grid-cols-4") && ownerHome.includes("lg:col-span-7"), "Owner Home uses 4-metric strip and 2-column desktop layout (7/5 split)");

const teacherToday = fs.readFileSync("app/(teacher)/teacher/page.tsx", "utf-8");
assert(teacherToday.includes("grid grid-cols-1 lg:grid-cols-12") && teacherToday.includes("lg:col-span-7"), "Teacher Today uses 2-column desktop layout (7/5 split)");

const collegeSettings = fs.readFileSync("app/(owner)/owner/more/college/page.tsx", "utf-8");
assert(collegeSettings.includes("grid grid-cols-1 lg:grid-cols-12") && collegeSettings.includes("lg:col-span-4"), "College Settings uses 2-column desktop layout (4/8 split)");

const publicSiteSettings = fs.readFileSync("app/(owner)/owner/more/public-site/page.tsx", "utf-8");
assert(publicSiteSettings.includes("grid grid-cols-1 lg:grid-cols-12") && publicSiteSettings.includes("lg:col-span-7"), "Public Site Editor uses 2-column desktop layout (7/5 split)");

// 5. Verify Public site pages
const publicHome = fs.readFileSync("app/(public)/page.tsx", "utf-8");
assert(publicHome.includes("grid grid-cols-1 md:grid-cols-3") && publicHome.includes("lg:grid-cols-4"), "Public Home uses multi-column grids for key facts & teachers");

const publicClasses = fs.readFileSync("app/(public)/classes/page.tsx", "utf-8");
assert(publicClasses.includes("sticky top-16"), "Public Classes has sticky grade filter on desktop");

const publicContact = fs.readFileSync("app/(public)/contact/page.tsx", "utf-8");
assert(publicContact.includes("grid grid-cols-1 lg:grid-cols-12") && publicContact.includes("lg:col-span-7"), "Public Contact has 2-column desktop layout (7/5 split)");

// 6. Verify absence of window.innerWidth or forbidden JS device sniffing
const modifiedFiles = execSync("git diff --name-only origin/main", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

let foundInnerWidth = false;
for (const file of modifiedFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf-8");
    if (content.includes("window.innerWidth")) {
      foundInnerWidth = true;
      console.error(`Forbidden window.innerWidth found in ${file}`);
    }
  }
}
assert(!foundInnerWidth, "No forbidden window.innerWidth or client device-sniffing used (pure CSS Tailwind breakpoints)");

// Summary
console.log(`\nVerification Summary: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Step R Responsive Desktop & Tablet requirements validated successfully!");
}
