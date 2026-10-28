// Minimal service worker: makes the app installable. It caches nothing yet;
// the offline shopping list comes in a later version.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
