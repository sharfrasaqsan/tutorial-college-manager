import { adminDb } from "@/lib/firebase-admin";
import type {
  CollegeProfile,
  PublicSiteSettings,
  PublicSafeTeacher,
  PublicSafeClass,
  PublicSafeSlot,
  PublicSiteData,
} from "@/types";

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

export async function getPublicSiteData(): Promise<PublicSiteData> {
  try {
    // 1. Fetch College Profile & Public Site Settings in parallel
    const [collegeSnap, publicSiteSnap] = await Promise.all([
      adminDb.collection("settings").doc("college").get(),
      adminDb.collection("settings").doc("publicSite").get(),
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

    // 2. Fetch Active Academic Year
    let activeYear = new Date().getFullYear().toString();
    try {
      const yearsSnap = await adminDb
        .collection("years")
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!yearsSnap.empty) {
        activeYear = yearsSnap.docs[0].id;
      } else {
        const anyYearSnap = await adminDb
          .collection("years")
          .orderBy("id", "desc")
          .limit(1)
          .get();
        if (!anyYearSnap.empty) {
          activeYear = anyYearSnap.docs[0].id;
        }
      }
    } catch {
      // Fallback year if collection uninitialized
    }

    // 3. Fetch Public Teachers (active == true AND showOnPublicSite == true)
    // Strictly filter out email and phone
    let teachers: PublicSafeTeacher[] = [];
    try {
      const teachersSnap = await adminDb
        .collection("teachers")
        .where("active", "==", true)
        .where("showOnPublicSite", "==", true)
        .get();

      teachers = teachersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "Teacher",
          photoUrl: data.photoUrl || undefined,
          bio: data.bio || "",
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
        };
      });
    } catch (err) {
      console.warn("Failed to query public teachers:", err);
    }

    // 4. Fetch Classes for Active Year
    // Strictly filter out internal financials and student enrolments
    let classes: PublicSafeClass[] = [];
    try {
      const classesSnap = await adminDb
        .collection("years")
        .doc(activeYear)
        .collection("classes")
        .where("active", "==", true)
        .get();

      classes = classesSnap.docs.map((doc) => {
        const data = doc.data();
        // Determine monthly fee from currentTerms or termsHistory
        let fee = 0;
        if (data.currentTerms && typeof data.currentTerms.monthlyFee === "number") {
          fee = data.currentTerms.monthlyFee;
        } else if (Array.isArray(data.termsHistory) && data.termsHistory.length > 0) {
          fee = data.termsHistory[data.termsHistory.length - 1].monthlyFee || 0;
        }

        return {
          id: doc.id,
          grade: data.grade || "General",
          subject: data.subject || data.name || "Subject",
          teacherName: data.teacherName || "Assigned Faculty",
          monthlyFee: fee,
        };
      });
    } catch (err) {
      console.warn("Failed to query public classes:", err);
    }

    // 5. Fetch Timetable Slots for Active Year (NEVER sessions or makeups)
    let slots: PublicSafeSlot[] = [];
    try {
      const slotsSnap = await adminDb
        .collection("years")
        .doc(activeYear)
        .collection("timetableSlots")
        .get();

      slots = slotsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          classId: data.classId || "",
          grade: data.grade || "",
          subject: data.subject || data.className || "Class",
          teacherName: data.teacherName || "Teacher",
          weekday: typeof data.weekday === "number" ? data.weekday : 0,
          startTime: data.startTime || "08:00",
          endTime: data.endTime || "10:00",
        };
      });
    } catch (err) {
      console.warn("Failed to query public timetable slots:", err);
    }

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

    return {
      college: mergedCollege,
      teachers,
      classes,
      slots,
      activeYear,
    };
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
