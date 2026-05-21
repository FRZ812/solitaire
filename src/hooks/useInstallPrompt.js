import { useEffect, useState } from "react";

// Captures Chrome's beforeinstallprompt event so we can offer a proper
// in-app "Install" button. If Chrome fires the event, the site IS
// installable; if it never fires, the menu's "Add to Home Screen" is
// the only thing Chrome will offer — that distinction is also useful
// as a diagnostic.
//
// Returns:
//   canInstall   — true once Chrome has fired beforeinstallprompt
//   installed    — true after the user accepts (or the app was already
//                  installed and reopened from the home screen)
//   promptInstall — invoke to surface the native install dialog;
//                   resolves with "accepted" | "dismissed" | null
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferred(e);
    }
    function onAppInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return null;
    deferred.prompt();
    try {
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      return outcome;
    } catch {
      setDeferred(null);
      return null;
    }
  }

  return { canInstall: !!deferred && !installed, installed, promptInstall };
}
