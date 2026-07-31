import React from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";
import { colors, shadow, glass } from "./tokens.js";

// Floating "Install app" pill, web-only. Renders ONLY when Chrome has fired
// beforeinstallprompt (i.e. the site is actually installable). Doubles as a
// diagnostic — if the pill never shows after redeploying with the PNG icons
// and a registered SW, then Chrome itself is refusing installability and
// the issue is upstream of the menu UI.
export function InstallPill() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <button
      className="install-pill"
      onClick={promptInstall}
      aria-label="Install Solitaire as an app"
      style={{
        position: "fixed",
        right: "calc(env(safe-area-inset-right, 0px) + 14px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        zIndex: 1000,
        ...glass,
        backgroundColor: "rgba(13, 19, 18, 0.82)",
        color: colors.parchment,
        border: `1px solid ${colors.gold}55`,
        borderRadius: "999px",
        minHeight: "44px",
        padding: "10px 16px 10px 14px",
        fontFamily: "inherit",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        boxShadow: shadow.cardDeep,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke={colors.gold} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M6 11l6 6 6-6M5 21h14"/>
      </svg>
      Install app
    </button>
  );
}
