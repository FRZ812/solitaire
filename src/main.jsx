import React from "react";
import ReactDOM from "react-dom/client";
import { Solitaire } from "./App.jsx";
import { InstallPill } from "./components/InstallPill.jsx";
import { PwaDiagnostics } from "./components/PwaDiagnostics.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <Solitaire />
    {/* Floating PWA install pill — renders only in web mode and only when
        Chrome has fired beforeinstallprompt. position: fixed so it floats
        over whatever screen is active. */}
    <InstallPill />
    {/* In-page diagnostic panel. Visit /#pwa on the phone to see why
        Chrome isn't classifying the site as installable. */}
    <PwaDiagnostics />
  </>
);

// Register the PWA service worker only in the web build. The artifact build
// runs inside a Claude artifact pane with no static-file serving, so /sw.js
// would 404; gating here avoids a noisy registration error.
//
// Path note: built with `import.meta.env.BASE_URL` so it works under any
// subpath deploy (e.g. GitHub Pages /solitaire/). Without this, register()
// would target the domain root and 404 on hosts that aren't root-deploys.
if (
  __SOLITAIRE_MODE__ === "web" &&
  typeof window !== "undefined" &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Registration is best-effort; install prompt simply won't appear.
    });
  });
}
