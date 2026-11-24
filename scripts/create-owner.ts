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

// Check if a service-account.json file exists in current directory or parent
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
  console.log(`Using service account file: ${serviceAccountPath}`);
  credential = cert(serviceAccountPath);
} else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  console.log(`Using FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY from environment`);
  credential = cert({
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
}

if (!credential && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.warn(
    "\n⚠️  No service account credentials found.\n" +
      "To run this script with live Firebase, either:\n" +
      "  1. Place 'service-account.json' in the tutorial-college-manager directory, or\n" +
      "  2. Provide FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.\n"
  );
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

async function createOwner() {
  const email = process.env.OWNER_EMAIL || "owner@college.lk";
  const password = process.env.OWNER_PASSWORD || "OwnerCollege2026!";

  console.log(`Setting up college owner account for: ${email}`);

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
    console.log(`User already exists (uid: ${user.uid}). Updating credentials and claims...`);
    user = await adminAuth.updateUser(user.uid, {
      password,
      displayName: "College Owner",
      emailVerified: true,
    });
  } catch {
    console.log(`Creating new user account...`);
    user = await adminAuth.createUser({
      email,
      password,
      displayName: "College Owner",
      emailVerified: true,
    });
  }

  // Set custom user claims: role = "owner"
  await adminAuth.setCustomUserClaims(user.uid, {
    role: "owner",
  });
  console.log(`Custom claim { role: "owner" } successfully set for uid: ${user.uid}`);

  // Sync to Firestore users collection
  await adminDb.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      displayName: "College Owner",
      role: "owner",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log(`Firestore record synced for users/${user.uid}`);

  console.log("\n--- Owner Account Setup Complete ---");
  console.log(`Email:    ${email}`);
  console.log(`Role:     owner`);
  console.log(`UID:      ${user.uid}`);
}

createOwner()
  .then(() => {
    console.log("Script completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error creating owner account:", err.message || err);
    process.exit(1);
  });
