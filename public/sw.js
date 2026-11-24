// Service Worker for Tutorial College Manager PWA
const CACHE_NAME = "tcm-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch handler for PWA installability requirements
  return;
});
