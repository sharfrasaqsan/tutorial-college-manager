import * as fs from "fs";
import * as path from "path";
import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

if (getApps().length === 0) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "tutorial-college-management";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n")
    : undefined;

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
  } else if (clientEmail && privateKey) {
    credential = cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  adminApp = initializeApp(
    credential
      ? { credential, storageBucket: `${projectId}.firebasestorage.app` }
      : { projectId, storageBucket: `${projectId}.firebasestorage.app` }
  );
} else {
  adminApp = getApp();
}

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export { adminApp };
