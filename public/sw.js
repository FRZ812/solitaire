// Minimal service worker. Its only job today is to exist — Chrome on
// Android requires a registered SW with a fetch handler before it will
// offer the "Add to Home Screen" install prompt. We don't intercept
// anything: the fetch handler is a pass-through, leaving the browser's
// default network behaviour intact.
//
// Future work could cache the built bundle + supabase auth check so the
// app boots offline; the registration scaffold below is ready for that.

self.addEventListener("install", (event) => {
  // Take over immediately rather than waiting for the next page load.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through. Required to be present (even no-op) for Chrome's
  // installability heuristic; do not respondWith.
});
