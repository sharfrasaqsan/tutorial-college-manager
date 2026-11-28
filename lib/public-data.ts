import { adminDb } from "./firebase-admin.ts";
import type {
  CollegeProfile,
  PublicSiteSettings,
  PublicSafeTeacher,
  PublicSafeClass,
  PublicSafeSlot,
  PublicSiteData,
} from "../types/index.ts";

export const DEFAULT_PUBLIC_SECTIONS = {
  showHero: true,
  showKeyFacts: true,
  showClasses: true,
  showTeacherStrip: true,
  showContactBlock: true,
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSiteSettings = {
  heroPromise: "",
  heroSubtext: "",
  aboutText: "",
  keyFacts: {
    location: "Colombo, Sri Lanka",
    yearsRunning: "Over 10 years of academic distinction",
    gradesTaught: "Grades 6 through 13 (O/L and A/L)",
  },
  whatsappNumber: "",
  mapUrl: "",
  admissionFeeNote: "A one-time admission & registration fee applies upon student enrollment.",
  sections: DEFAULT_PUBLIC_SECTIONS,
};

let cachedPublicSiteData: PublicSiteData | null = null;
let cachedPublicSiteDataExpiresAt = 0;
// Cache TTL 0 ensures real-time instant synchronization with database updates
const PUBLIC_DATA_CACHE_TTL_MS = 0;

export function invalidatePublicSiteDataCache(): void {
  cachedPublicSiteData = null;
  cachedPublicSiteDataExpiresAt = 0;
  try {
    import("next/cache")
      .then((mod) => mod.revalidatePath?.("/", "layout"))
      .catch(() => {});
  } catch {
    // Gracefully ignore outside request contexts
  }
}

export async function getPublicSiteData(): Promise<PublicSiteData> {
  const now = Date.now();
  if (PUBLIC_DATA_CACHE_TTL_MS > 0 && cachedPublicSiteData && now < cachedPublicSiteDataExpiresAt) {
    return cachedPublicSiteData;
  }

  try {
    // 1. Fetch Active Academic Year and settings
    let activeYear = new Date().getFullYear().toString();
    try {
      const academicSnap = await adminDb.collection("settings").doc("academic").get();
      const academicData = academicSnap.exists ? academicSnap.data() : null;
      if (academicData?.activeYear && /^\d{4}$/.test(academicData.activeYear)) {
        activeYear = academicData.activeYear;
      } else {
        const yearsSnap = await adminDb.collection("years").get();
        if (!yearsSnap.empty) {
          const currentCalendarYear = new Date().getFullYear().toString();
          const currentYearDoc = yearsSnap.docs.find(
            (d) => d.id === currentCalendarYear && d.data().status === "active"
          );
          if (currentYearDoc) {
            activeYear = currentYearDoc.id;
          } else {
            const activeDoc = yearsSnap.docs.find((d) => d.data().status === "active");
            if (activeDoc) {
              activeYear = activeDoc.id;
            } else {
              const sorted = [...yearsSnap.docs].sort((a, b) => b.id.localeCompare(a.id));
              activeYear = sorted[0].id;
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to determine active year for public site:", err);
    }

    // 2. Fetch College Profile, Public Site Settings, Teachers, Classes, and Slots ALL in parallel
    const [collegeSnap, publicSiteSnap, teachersSnap, classesSnap, slotsSnapPrimary] =
      await Promise.all([
        adminDb.collection("settings").doc("college").get(),
        adminDb.collection("settings").doc("publicSite").get(),
        adminDb
          .collection("teachers")
          .where("active", "==", true)
          .where("showOnPublicSite", "==", true)
          .get(),
        adminDb
          .collection("years")
          .doc(activeYear)
          .collection("classes")
          .where("active", "==", true)
          .get(),
        adminDb
          .collection("years")
          .doc(activeYear)
          .collection("slots")
          .get(),
      ]);

    const collegeData = collegeSnap.exists
      ? (collegeSnap.data() as CollegeProfile)
      : {
          name: "Tutorial College",
          logoUrl: "",
          address: "Colombo, Sri Lanka",
          phone: "",
          email: "",
          aboutText: "",
          openingHours: "Mon - Sat: 08:00 AM - 06:00 PM",
          updatedAt: new Date().toISOString(),
        };

    const publicSettings = publicSiteSnap.exists
      ? (publicSiteSnap.data() as PublicSiteSettings)
      : DEFAULT_PUBLIC_SETTINGS;

    // 3. Process Public Teachers
    const teacherMap = new Map<string, string>();
    const teachers: PublicSafeTeacher[] = teachersSnap.docs
      .filter((doc) => {
        const data = doc.data();
        return !(data.deletedInYear && data.deletedInYear <= activeYear);
      })
      .map((doc): PublicSafeTeacher => {
        const data = doc.data();
        const teacherObj = {
          id: doc.id,
          name: data.name || "Teacher",
          photoUrl: data.photoUrl || undefined,
          bio: data.bio || "",
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
        };
        teacherMap.set(doc.id, teacherObj.name);
        return teacherObj;
      });

    // 4. Process Classes for Active Year (exclude non-repeating extra/temporary classes)
    const classes: PublicSafeClass[] = classesSnap.docs
      .filter((doc) => {
        const data = doc.data();
        if (
          data.isTemporary === true ||
          data.isExtra === true ||
          data.slotType === "extra" ||
          data.type === "extra" ||
          data.classType === "extra" ||
          Boolean(data.specificDate)
        ) {
          return false;
        }
        return true;
      })
      .map((doc) => {
      const data = doc.data();
      let fee = 0;
      if (data.currentTerms && typeof data.currentTerms.monthlyFee === "number") {
        fee = data.currentTerms.monthlyFee;
      } else if (Array.isArray(data.termsHistory) && data.termsHistory.length > 0) {
        fee = data.termsHistory[data.termsHistory.length - 1].monthlyFee || 0;
      }

      const resolvedTeacherName =
        data.teacherName ||
        (data.teacherId ? teacherMap.get(data.teacherId) : null) ||
        "Assigned Faculty";

      return {
        id: doc.id,
        grade: data.grade || "General",
        subject: data.subject || data.name || "Subject",
        teacherName: resolvedTeacherName,
        monthlyFee: fee,
      };
    });

    // 5. Process Timetable Slots for Active Year (exclude non-repeating extra/temporary slots)
    let slotsSnap = slotsSnapPrimary;
    if (slotsSnap.empty) {
      slotsSnap = await adminDb
        .collection("years")
        .doc(activeYear)
        .collection("timetableSlots")
        .get();
    }

    const slots: PublicSafeSlot[] = slotsSnap.docs
      .filter((doc) => {
        const data = doc.data();
        if (
          data.isTemporary === true ||
          data.isExtra === true ||
          data.slotType === "extra" ||
          data.type === "extra" ||
          Boolean(data.specificDate)
        ) {
          return false;
        }
        return true;
      })
      .map((doc) => {
      const data = doc.data();
      const resolvedTeacherName =
        data.teacherName ||
        (data.teacherId ? teacherMap.get(data.teacherId) : null) ||
        "Faculty Member";

      return {
        id: doc.id,
        classId: data.classId || "",
        className: data.className || `${data.grade || ""} ${data.subject || ""}`.trim() || "Class",
        grade: data.grade || "",
        subject: data.subject || data.className || "Class",
        teacherName: resolvedTeacherName,
        weekday: typeof data.weekday === "number" ? data.weekday : 1,
        startTime: data.startTime || "08:00",
        endTime: data.endTime || "09:00",
        color: data.color || undefined,
        isTemporary: Boolean(data.isTemporary),
      };
    });

    // Combine into public-safe structure
    const mergedCollege = {
      ...collegeData,
      heroPromise: publicSettings.heroPromise || "",
      heroSubtext: publicSettings.heroSubtext || "",
      aboutText: publicSettings.aboutText || collegeData.aboutText || "",
      keyFacts: publicSettings.keyFacts || DEFAULT_PUBLIC_SETTINGS.keyFacts,
      whatsappNumber: publicSettings.whatsappNumber || "",
      mapUrl: publicSettings.mapUrl || "",
      admissionFeeNote: publicSettings.admissionFeeNote || DEFAULT_PUBLIC_SETTINGS.admissionFeeNote,
      sections: publicSettings.sections || DEFAULT_PUBLIC_SECTIONS,
    };

    const result: PublicSiteData = {
      college: mergedCollege,
      teachers,
      classes,
      slots,
      activeYear,
    };

    cachedPublicSiteData = result;
    cachedPublicSiteDataExpiresAt = Date.now() + PUBLIC_DATA_CACHE_TTL_MS;

    return result;
  } catch (err) {
    console.error("Error generating public site data:", err);
    return {
      college: {
        name: "Tutorial College",
        address: "Colombo, Sri Lanka",
        phone: "",
        email: "",
        aboutText: "",
        openingHours: "Mon - Sat: 08:00 AM - 06:00 PM",
        updatedAt: new Date().toISOString(),
        keyFacts: DEFAULT_PUBLIC_SETTINGS.keyFacts,
        sections: DEFAULT_PUBLIC_SECTIONS,
      },
      teachers: [],
      classes: [],
      slots: [],
      activeYear: new Date().getFullYear().toString(),
    };
  }
}
