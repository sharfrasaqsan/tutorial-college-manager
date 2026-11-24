import * as fs from "fs";
import * as path from "path";
import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: Storage | null = null;
let cachedMessaging: Messaging | null = null;

function normalizePrivateKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!key.includes("-----BEGIN PRIVATE KEY-----") && key.length > 100) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN PRIVATE KEY-----")) {
        key = decoded;
      }
    } catch {
      // Not base64
    }
  }
  return key;
}

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "tutorial-college-management";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

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

  if (!credential) {
    throw new Error(
      "Firebase Admin credentials missing. Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in your Vercel Environment Variables."
    );
  }

  cachedApp = initializeApp({
    credential,
    storageBucket: `${projectId}.firebasestorage.app`,
  });

  return cachedApp;
}

// Lazy Proxies so module import never crashes on startup if env vars are missing
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!cachedAuth) {
      cachedAuth = getAuth(getAdminApp());
    }
    const val = (cachedAuth as any)[prop];
    return typeof val === "function" ? val.bind(cachedAuth) : val;
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!cachedDb) {
      cachedDb = getFirestore(getAdminApp());
      try {
        cachedDb.settings({ ignoreUndefinedProperties: true });
      } catch {
        // Settings already initialized
      }
    }
    const val = (cachedDb as any)[prop];
    return typeof val === "function" ? val.bind(cachedDb) : val;
  },
});

export const adminStorage = new Proxy({} as Storage, {
  get(_target, prop) {
    if (!cachedStorage) {
      cachedStorage = getStorage(getAdminApp());
    }
    const val = (cachedStorage as any)[prop];
    return typeof val === "function" ? val.bind(cachedStorage) : val;
  },
});

export const adminMessaging = new Proxy({} as Messaging, {
  get(_target, prop) {
    if (!cachedMessaging) {
      cachedMessaging = getMessaging(getAdminApp());
    }
    const val = (cachedMessaging as any)[prop];
    return typeof val === "function" ? val.bind(cachedMessaging) : val;
  },
});

export { cachedApp as adminApp };

