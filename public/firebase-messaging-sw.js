// Firebase Cloud Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAfaZh-ori4BZVgMCNox0aOEB9_rYiWgHA",
  authDomain: "tutorial-college-management.firebaseapp.com",
  projectId: "tutorial-college-management",
  storageBucket: "tutorial-college-management.firebasestorage.app",
  messagingSenderId: "492967172764",
  appId: "1:492967172764:web:f4e7cdabf6e45fa1a7eb59",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || "Tutorial College Manager";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "New update available.",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    data: {
      link: payload.data?.link || payload.fcmOptions?.link || "/",
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
