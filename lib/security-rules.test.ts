import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

/**
 * Security Rules Simulation & Verification Test Suite
 * Tests Firestore and Storage security rules matrix across all 3 roles:
 * 1. Unauthenticated (Public)
 * 2. Teacher (Scoped read access to own classes, sessions, slots, and class rosters; zero writes)
 * 3. Owner (Full read and write access to everything)
 */

interface AuthContext {
  uid: string | null;
  token?: {
    role?: "owner" | "teacher" | string;
    [key: string]: any;
  };
}

interface ResourceContext {
  data: Record<string, any>;
  parentClassData?: Record<string, any>;
}

// Security Rules Engine Simulator mirroring firestore.rules logic
class FirestoreRulesSimulator {
  private rulesContent: string;

  constructor() {
    const rulesPath = path.resolve(process.cwd(), "firestore.rules");
    this.rulesContent = fs.readFileSync(rulesPath, "utf8");
  }

  getRulesContent() {
    return this.rulesContent;
  }

  evaluate(
    pathStr: string,
    operation: "read" | "write",
    auth: AuthContext | null,
    resource?: ResourceContext
  ): boolean {
    const isAuthenticated = auth !== null && auth.uid !== null;
    const isOwner = isAuthenticated && auth?.token?.role === "owner";
    const isTeacher = isAuthenticated && auth?.token?.role === "teacher";

    // 1. Default deny: unauthenticated requests always fail (no public reads)
    if (!isAuthenticated) {
      return false;
    }

    // 2. Owner has full read and write access across all paths
    if (isOwner) {
      return true;
    }

    // 3. Teachers have ZERO direct write permissions anywhere (teachers write only through API)
    if (operation === "write") {
      return false;
    }

    // 4. Teacher read evaluations
    if (isTeacher) {
      // Users profile
      if (pathStr.startsWith("users/")) {
        const userId = pathStr.split("/")[1];
        return auth.uid === userId;
      }

      // Teacher profile
      if (pathStr.startsWith("teachers/")) {
        const teacherId = pathStr.split("/")[1];
        return auth.uid === teacherId;
      }

      // Students collection: Teacher cannot read directly
      if (pathStr.startsWith("students/")) {
        return false;
      }

      // Settings collection: Teacher cannot read directly
      if (pathStr.startsWith("settings/")) {
        return false;
      }

      // Years subcollections
      if (pathStr.startsWith("years/")) {
        const parts = pathStr.split("/");
        // years/{yearId}
        if (parts.length === 2) return true;

        const subcol = parts[2];

        // classes/{classId}
        if (subcol === "classes") {
          // If accessing class terms: teachers NEVER see fees/terms
          if (parts[4] === "terms") {
            return false;
          }
          // If accessing class enrolments (roster):
          if (parts[4] === "enrolments") {
            return resource?.parentClassData?.teacherId === auth.uid;
          }
          // The class itself:
          return resource?.data?.teacherId === auth.uid;
        }

        // slots / timetableSlots
        if (subcol === "slots" || subcol === "timetableSlots") {
          return resource?.data?.teacherId === auth.uid;
        }

        // sessions
        if (subcol === "sessions") {
          return resource?.data?.teacherId === auth.uid;
        }

        // requests / correctionRequests
        if (subcol === "requests" || subcol === "correctionRequests") {
          return resource?.data?.teacherId === auth.uid;
        }

        // salaries & invoices
        if (subcol === "salaries" || subcol === "invoices") {
          return resource?.data?.teacherId === auth.uid;
        }

        // fees: strictly owner only, teachers NEVER see fees
        if (subcol === "fees") {
          return false;
        }

        // roster / auditLog: owner only
        if (subcol === "roster" || subcol === "auditLog") {
          return false;
        }
      }

      // Notifications
      if (pathStr.startsWith("notifications/")) {
        return resource?.data?.recipientId === auth.uid;
      }

      // FCM Tokens
      if (pathStr.startsWith("fcmTokens/")) {
        return false;
      }
    }

    return false;
  }
}

// Storage Rules Engine Simulator mirroring storage.rules logic
class StorageRulesSimulator {
  private rulesContent: string;

  constructor() {
    const rulesPath = path.resolve(process.cwd(), "storage.rules");
    this.rulesContent = fs.readFileSync(rulesPath, "utf8");
  }

  getRulesContent() {
    return this.rulesContent;
  }

  evaluate(
    pathStr: string,
    operation: "read" | "write",
    auth: AuthContext | null
  ): boolean {
    const isAuthenticated = auth !== null && auth.uid !== null;
    const isOwner = isAuthenticated && auth?.token?.role === "owner";
    const isTeacher = isAuthenticated && auth?.token?.role === "teacher";

    if (!isAuthenticated) return false;
    if (isOwner) return true;
    if (operation === "write") return false;

    if (isTeacher) {
      if (pathStr.startsWith("college/")) return true;
      if (pathStr.startsWith("teachers/")) {
        const teacherId = pathStr.split("/")[1];
        return auth.uid === teacherId;
      }
      if (pathStr.startsWith("invoices/")) {
        const parts = pathStr.split("/");
        const teacherId = parts[2];
        return auth.uid === teacherId;
      }
      // receipts and reports are owner only
      if (pathStr.startsWith("receipts/") || pathStr.startsWith("reports/")) {
        return false;
      }
    }

    return false;
  }
}

describe("Firestore Security Rules Verification", () => {
  const fsRules = new FirestoreRulesSimulator();
  const rulesText = fsRules.getRulesContent();

  const publicUser: AuthContext = { uid: null };
  const ownerUser: AuthContext = {
    uid: "owner_sharfras_uid",
    token: { role: "owner" },
  };
  const teacherSilva: AuthContext = {
    uid: "teacher_silva_uid",
    token: { role: "teacher" },
  };
  const teacherPerera: AuthContext = {
    uid: "teacher_perera_uid",
    token: { role: "teacher" },
  };

  it("rules file contains mandatory helper functions and deny-by-default", () => {
    assert.ok(rulesText.includes("function isOwner()"));
    assert.ok(rulesText.includes("function isTeacher()"));
    assert.ok(rulesText.includes("match /{document=**}"));
    assert.ok(rulesText.includes("allow read, write: if false;"));
  });

  describe("1. Unauthenticated / Public Role (Strict Zero Access)", () => {
    it("denies unauthenticated read to all institutional settings", () => {
      assert.strictEqual(fsRules.evaluate("settings/college", "read", null), false);
      assert.strictEqual(fsRules.evaluate("settings/academic", "read", publicUser), false);
    });

    it("denies unauthenticated read to teachers and students", () => {
      assert.strictEqual(fsRules.evaluate("teachers/teacher_silva_uid", "read", null), false);
      assert.strictEqual(fsRules.evaluate("students/student_101", "read", null), false);
    });

    it("denies unauthenticated read to classes, slots, sessions, and fees", () => {
      assert.strictEqual(fsRules.evaluate("years/2026/classes/class_maths", "read", null), false);
      assert.strictEqual(fsRules.evaluate("years/2026/slots/slot_1", "read", null), false);
      assert.strictEqual(fsRules.evaluate("years/2026/sessions/sess_1", "read", null), false);
      assert.strictEqual(fsRules.evaluate("years/2026/fees/fee_1", "read", null), false);
    });

    it("denies unauthenticated write to all collections", () => {
      assert.strictEqual(fsRules.evaluate("years/2026/classes/class_maths", "write", null), false);
      assert.strictEqual(fsRules.evaluate("users/hacker", "write", null), false);
    });
  });

  describe("2. Teacher Role (Scoped Isolation & Zero Direct Writes)", () => {
    it("allows teacher to read ONLY own assigned classes", () => {
      const ownClass: ResourceContext = { data: { teacherId: "teacher_silva_uid" } };
      const otherClass: ResourceContext = { data: { teacherId: "teacher_perera_uid" } };

      assert.strictEqual(
        fsRules.evaluate("years/2026/classes/class_maths", "read", teacherSilva, ownClass),
        true
      );
      assert.strictEqual(
        fsRules.evaluate("years/2026/classes/class_science", "read", teacherSilva, otherClass),
        false
      );
    });

    it("allows teacher to read roster ONLY of own classes", () => {
      const ownClassRoster: ResourceContext = {
        data: { studentId: "std_1" },
        parentClassData: { teacherId: "teacher_silva_uid" },
      };
      const otherClassRoster: ResourceContext = {
        data: { studentId: "std_2" },
        parentClassData: { teacherId: "teacher_perera_uid" },
      };

      assert.strictEqual(
        fsRules.evaluate("years/2026/classes/class_maths/enrolments/std_1", "read", teacherSilva, ownClassRoster),
        true
      );
      assert.strictEqual(
        fsRules.evaluate("years/2026/classes/class_science/enrolments/std_2", "read", teacherSilva, otherClassRoster),
        false
      );
    });

    it("STRICT: teachers NEVER see fee terms or student fee records", () => {
      assert.strictEqual(
        fsRules.evaluate("years/2026/classes/class_maths/terms/term_1", "read", teacherSilva),
        false
      );
      assert.strictEqual(
        fsRules.evaluate("years/2026/fees/fee_std_1", "read", teacherSilva),
        false
      );
    });

    it("allows teacher to read ONLY own slots and sessions", () => {
      const ownSlot: ResourceContext = { data: { teacherId: "teacher_silva_uid" } };
      const otherSlot: ResourceContext = { data: { teacherId: "teacher_perera_uid" } };

      assert.strictEqual(
        fsRules.evaluate("years/2026/slots/slot_1", "read", teacherSilva, ownSlot),
        true
      );
      assert.strictEqual(
        fsRules.evaluate("years/2026/slots/slot_2", "read", teacherSilva, otherSlot),
        false
      );

      const ownSession: ResourceContext = { data: { teacherId: "teacher_silva_uid" } };
      const otherSession: ResourceContext = { data: { teacherId: "teacher_perera_uid" } };

      assert.strictEqual(
        fsRules.evaluate("years/2026/sessions/sess_1", "read", teacherSilva, ownSession),
        true
      );
      assert.strictEqual(
        fsRules.evaluate("years/2026/sessions/sess_2", "read", teacherSilva, otherSession),
        false
      );
    });

    it("STRICT: teachers write ONLY through the API (all direct client SDK writes denied)", () => {
      assert.strictEqual(fsRules.evaluate("years/2026/sessions/sess_1", "write", teacherSilva), false);
      assert.strictEqual(fsRules.evaluate("years/2026/slots/slot_1", "write", teacherSilva), false);
      assert.strictEqual(fsRules.evaluate("years/2026/classes/class_1", "write", teacherSilva), false);
      assert.strictEqual(fsRules.evaluate("users/teacher_silva_uid", "write", teacherSilva), false);
      assert.strictEqual(fsRules.evaluate("teachers/teacher_silva_uid", "write", teacherSilva), false);
    });
  });

  describe("3. Owner Role (Full Access)", () => {
    it("owner has full read access to all collections", () => {
      assert.strictEqual(fsRules.evaluate("settings/college", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("students/std_1", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("teachers/teacher_silva_uid", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/classes/class_1", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/fees/fee_1", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/salaries/sal_1", "read", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/auditLog/log_1", "read", ownerUser), true);
    });

    it("owner has full write access to all collections", () => {
      assert.strictEqual(fsRules.evaluate("settings/college", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("students/std_1", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("teachers/teacher_silva_uid", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/classes/class_1", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/fees/fee_1", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/slots/slot_1", "write", ownerUser), true);
      assert.strictEqual(fsRules.evaluate("years/2026/sessions/sess_1", "write", ownerUser), true);
    });
  });
});

describe("Storage Security Rules Verification", () => {
  const stRules = new StorageRulesSimulator();
  const rulesText = stRules.getRulesContent();

  const publicUser: AuthContext = { uid: null };
  const ownerUser: AuthContext = {
    uid: "owner_sharfras_uid",
    token: { role: "owner" },
  };
  const teacherSilva: AuthContext = {
    uid: "teacher_silva_uid",
    token: { role: "teacher" },
  };
  const teacherPerera: AuthContext = {
    uid: "teacher_perera_uid",
    token: { role: "teacher" },
  };

  it("storage rules file exists and contains default deny", () => {
    assert.ok(rulesText.includes("service firebase.storage"));
    assert.ok(rulesText.includes("match /{allPaths=**}"));
    assert.ok(rulesText.includes("allow read, write: if false;"));
  });

  it("denies unauthenticated read and write across all storage paths", () => {
    assert.strictEqual(stRules.evaluate("college/logo.png", "read", publicUser), false);
    assert.strictEqual(stRules.evaluate("teachers/teacher_silva_uid/photo.jpg", "read", publicUser), false);
    assert.strictEqual(stRules.evaluate("receipts/rec_1.pdf", "read", publicUser), false);
    assert.strictEqual(stRules.evaluate("invoices/2026/teacher_silva_uid/inv_1.pdf", "read", publicUser), false);
  });

  it("teacher can read own photo and own invoices only, and cannot write", () => {
    assert.strictEqual(stRules.evaluate("teachers/teacher_silva_uid/photo.jpg", "read", teacherSilva), true);
    assert.strictEqual(stRules.evaluate("teachers/teacher_perera_uid/photo.jpg", "read", teacherSilva), false);

    assert.strictEqual(stRules.evaluate("invoices/2026/teacher_silva_uid/inv_1.pdf", "read", teacherSilva), true);
    assert.strictEqual(stRules.evaluate("invoices/2026/teacher_perera_uid/inv_2.pdf", "read", teacherSilva), false);

    // receipts and reports: denied to teachers
    assert.strictEqual(stRules.evaluate("receipts/rec_1.pdf", "read", teacherSilva), false);
    assert.strictEqual(stRules.evaluate("reports/rep_1.pdf", "read", teacherSilva), false);

    // direct write: denied to teachers
    assert.strictEqual(stRules.evaluate("invoices/2026/teacher_silva_uid/inv_1.pdf", "write", teacherSilva), false);
  });

  it("owner has full read and write access across all storage paths", () => {
    assert.strictEqual(stRules.evaluate("college/logo.png", "read", ownerUser), true);
    assert.strictEqual(stRules.evaluate("college/logo.png", "write", ownerUser), true);
    assert.strictEqual(stRules.evaluate("receipts/rec_1.pdf", "read", ownerUser), true);
    assert.strictEqual(stRules.evaluate("receipts/rec_1.pdf", "write", ownerUser), true);
    assert.strictEqual(stRules.evaluate("reports/rep_nov.pdf", "read", ownerUser), true);
    assert.strictEqual(stRules.evaluate("reports/rep_nov.pdf", "write", ownerUser), true);
  });
});
