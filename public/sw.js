// PingLead service worker: shows Web Push alerts for new matching projects and opens
// the project when the notification is clicked. No caching / offline logic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PingLead", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "PingLead: مشروع جديد";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      dir: "rtl",
      lang: "ar",
      tag: data.tag || undefined, // same project twice replaces instead of stacking
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Project links are external: always open a new tab for them
      if (url.startsWith("/")) {
        for (const w of windows) {
          if (new URL(w.url).origin === self.location.origin && "focus" in w) {
            w.navigate(url);
            return w.focus();
          }
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
