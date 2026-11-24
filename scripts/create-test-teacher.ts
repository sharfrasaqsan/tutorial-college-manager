import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "tutorial-college-management";

let serviceAccountPath: string | null = null;
const possiblePaths = [
  path.resolve(process.cwd(), "service-account.json"),
  path.resolve(process.cwd(), "serviceAccountKey.json"),
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
].filter(Boolean);

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

let credential;
if (serviceAccountPath) {
  credential = cert(serviceAccountPath);
} else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  credential = cert({
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
}

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        credential
          ? { credential, storageBucket: `${projectId}.firebasestorage.app` }
          : { projectId, storageBucket: `${projectId}.firebasestorage.app` }
      );

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

async function createTestTeacher() {
  const email = process.env.TEST_TEACHER_EMAIL || "silva.maths@college.lk";
  const password = process.env.TEST_TEACHER_PASSWORD || "TeacherSilva2026!";
  const name = "Mr. K. Silva";

  console.log(`Setting up test teacher account for: ${email}`);

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
    console.log(`User already exists (uid: ${user.uid}). Updating credentials and claims...`);
    user = await adminAuth.updateUser(user.uid, {
      password,
      displayName: name,
      emailVerified: true,
    });
  } catch {
    console.log(`Creating new user account...`);
    user = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
  }

  // Set custom user claims: role = "teacher"
  await adminAuth.setCustomUserClaims(user.uid, {
    role: "teacher",
  });
  console.log(`Custom claim { role: "teacher" } successfully set for uid: ${user.uid}`);

  // Save teacher in Firestore
  await adminDb.collection("teachers").doc(user.uid).set(
    {
      id: user.uid,
      name,
      email,
      subjects: ["Mathematics"],
      active: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log(`Firestore record synced for teachers/${user.uid}`);

  console.log("\n--- Teacher Account Setup Complete ---");
  console.log(`Name:     ${name}`);
  console.log(`Email:    ${email}`);
  console.log(`Role:     teacher`);
  console.log(`UID:      ${user.uid}`);
}

createTestTeacher()
  .then(() => {
    console.log("Script completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error creating test teacher:", err.message || err);
    process.exit(1);
  });
