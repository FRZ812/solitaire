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
if (
  __SOLITAIRE_MODE__ === "web" &&
  typeof window !== "undefined" &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort; install prompt simply won't appear.
    });
  });
}
