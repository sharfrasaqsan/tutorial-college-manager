"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Signs out of both server session cookie and Firebase client auth in parallel,
 * then navigates cleanly to /login.
 */
export async function performSignOut(router?: {
  replace: (url: string) => void;
}): Promise<void> {
  const [logoutResult] = await Promise.allSettled([
    fetch("/api/auth/logout", { method: "POST" }),
    signOut(auth),
  ]);

  const serverCleared =
    logoutResult.status === "fulfilled" && logoutResult.value.ok;

  if (router && serverCleared) {
    router.replace("/login");
    setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }, 800);
  } else {
    window.location.replace("/login");
  }
}
