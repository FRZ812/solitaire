import React, { useEffect, useState } from "react";
import { colors, fonts, shadow } from "./tokens.js";

// In-page PWA diagnostics — visit /#pwa on the phone to see why Chrome isn't
// classifying the site as installable. Fetches the manifest, walks the
// service-worker registrations, probes the icon URLs, and reports the few
// things Chrome's installability heuristic actually checks. No desktop
// devtools required.
export function PwaDiagnostics() {
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" && /^#pwa\b/.test(window.location.hash)
  );
  const [data, setData] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => setOpen(/^#pwa\b/.test(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!open) { setData(null); return; }
    let cancelled = false;
    (async () => {
      const d = await collect();
      if (!cancelled) setData(d);
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      backgroundColor: colors.ink,
      color: colors.parchment,
      fontFamily: "ui-monospace, SFMono-Regular, 'Menlo', monospace",
      fontSize: "12px",
      overflowY: "auto",
      padding: "calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 24px) 14px",
      boxSizing: "border-box",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "14px", paddingBottom: "12px",
        borderBottom: `1px solid ${colors.gold}33`,
      }}>
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "22px", color: colors.parchmentLight,
        }}>
          PWA diagnostics
        </div>
        <button
          onClick={() => { history.replaceState(null, "", location.pathname + location.search); setOpen(false); }}
          style={{
            padding: "6px 12px", fontSize: "12px",
            backgroundColor: "transparent",
            color: colors.parchment,
            border: `1px solid ${colors.gold}55`,
            borderRadius: "999px", fontFamily: "inherit",
            cursor: "pointer",
          }}
        >Close</button>
      </div>

      {!data ? (
        <div style={{ opacity: 0.6 }}>collecting…</div>
      ) : (
        <>
          <Section title="Page">
            <Row label="HTTPS" value={data.https ? "yes" : "NO — required for installability"} ok={data.https} />
            <Row label="Display mode" value={data.displayMode} ok={data.displayMode === "standalone" || data.displayMode === "fullscreen" ? true : null} />
            <Row label="iOS standalone" value={String(data.iosStandalone ?? false)} />
            <Row label="Service Worker support" value={data.sw.supported ? "yes" : "no"} ok={data.sw.supported} />
            <Row label="Base URL (build)" value={data.base} />
            <Row label="User agent" value={data.userAgent} mono />
          </Section>

          <Section title={`Manifest (${data.manifestUrl})`}>
            {data.manifest?.error ? (
              <Row label="fetch error" value={data.manifest.error} ok={false} />
            ) : (
              <>
                <Row label="HTTP status" value={data.manifest.status} ok={data.manifest.ok} />
                <Row label="Content-Type" value={data.manifest.contentType || "(none)"} ok={(data.manifest.contentType || "").includes("manifest")} />
                {data.manifest.parsed ? (
                  <>
                    <Row label="name" value={data.manifest.parsed.name || "(missing)"} ok={!!data.manifest.parsed.name} />
                    <Row label="short_name" value={data.manifest.parsed.short_name || "(missing)"} />
                    <Row label="start_url" value={data.manifest.parsed.start_url || "(missing)"} ok={!!data.manifest.parsed.start_url} />
                    <Row label="scope" value={data.manifest.parsed.scope || "(default)"} />
                    <Row label="display" value={data.manifest.parsed.display || "(missing)"} ok={["standalone", "fullscreen", "minimal-ui"].includes(data.manifest.parsed.display)} />
                    <Row label="background_color" value={data.manifest.parsed.background_color || "(missing)"} />
                    <Row label="theme_color" value={data.manifest.parsed.theme_color || "(missing)"} />
                    <Row label="icons declared" value={String(data.manifest.parsed.icons?.length ?? 0)} ok={(data.manifest.parsed.icons?.length ?? 0) >= 1} />
                  </>
                ) : (
                  <Row label="JSON parse" value="FAILED — see raw" ok={false} />
                )}
                {!data.manifest.parsed && data.manifest.raw && (
                  <pre style={{ background: "rgba(0,0,0,0.4)", padding: "8px", borderRadius: "6px", overflowX: "auto", marginTop: "8px" }}>{data.manifest.raw}</pre>
                )}
              </>
            )}
          </Section>

          <Section title="Icons">
            {data.icons.length === 0 ? (
              <Row label="" value="(no icons probed — manifest parse failed?)" ok={null} />
            ) : data.icons.map((i, n) => (
              <Row
                key={n}
                label={`${i.sizes} (${i.purpose || "any"})`}
                value={`${i.resolvedUrl || i.src} → ${i.status}${i.contentType ? ` · ${i.contentType}` : ""}${i.error ? ` · ${i.error}` : ""}`}
                ok={i.ok && (i.contentType || "").startsWith("image/")}
              />
            ))}
            <Row label="Needs ≥1 of" value="192x192 AND 512x512 PNG" />
          </Section>

          <Section title={`Service Worker (${data.swUrl})`}>
            <Row label="HTTP status" value={data.sw.fileStatus ?? data.sw.fileError ?? "(unfetched)"} ok={data.sw.fileStatus === 200} />
            <Row label="Content-Type" value={data.sw.fileContentType || "(none)"} ok={(data.sw.fileContentType || "").includes("javascript")} />
            <Row label="Registrations" value={String(data.sw.registrations.length)} ok={data.sw.registrations.length > 0} />
            {data.sw.registrations.map((r, n) => (
              <div key={n} style={{ marginLeft: "14px", marginTop: "6px" }}>
                <Row label="scope" value={r.scope} />
                <Row label="scriptURL" value={r.scriptURL || "(none)"} />
                <Row label="state" value={r.state} ok={r.state === "activated"} />
              </div>
            ))}
            <Row label="Controller" value={data.sw.controller || "(none — page not controlled yet)"} ok={!!data.sw.controller} />
          </Section>

          <Section title="What Chrome needs">
            <div style={{ opacity: 0.85, lineHeight: 1.55 }}>
              For Chrome on Android to offer <strong>Install app</strong> (not just "Add to Home Screen") all of these must be ✓:
              <ul style={{ paddingLeft: "18px", margin: "8px 0 0" }}>
                <li>HTTPS</li>
                <li>Valid manifest with <code>name</code>, <code>start_url</code>, <code>display: standalone</code></li>
                <li>Icons including a 192×192 PNG <em>and</em> a 512×512 PNG (purpose any)</li>
                <li>A service worker registered AND controlling the page, with a <code>fetch</code> handler</li>
                <li>Not already installed (or recently dismissed too many times)</li>
              </ul>
              <div style={{ marginTop: "10px", opacity: 0.75 }}>
                Tip: if Controller is "(none)" after the first load, hard-reload once — Chrome won't fire <code>beforeinstallprompt</code> until the page is actually controlled.
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{
        fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase",
        color: colors.gold, marginBottom: "8px", fontWeight: 700,
      }}>{title}</div>
      <div style={{
        background: "rgba(0,0,0,0.25)",
        border: `1px solid ${colors.gold}22`,
        borderRadius: "10px",
        padding: "10px 12px",
        boxShadow: shadow.subtle,
      }}>{children}</div>
    </div>
  );
}

function Row({ label, value, ok = null, mono = false }) {
  const dot = ok === true ? "#9ad991" : ok === false ? "#fca5a5" : "#888";
  return (
    <div style={{ display: "flex", gap: "10px", padding: "3px 0", alignItems: "flex-start" }}>
      <span style={{
        flexShrink: 0, marginTop: "6px",
        width: 6, height: 6, borderRadius: "50%", background: dot,
      }} />
      <span style={{ flexShrink: 0, opacity: 0.75, minWidth: "120px", paddingRight: "8px" }}>{label}</span>
      <span style={{
        wordBreak: "break-all", fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        opacity: 0.95,
      }}>{String(value)}</span>
    </div>
  );
}

async function collect() {
  // Probe the actual manifest URL Chrome would use (from <link rel="manifest">),
  // and the actual SW URL the app registers (built with import.meta.env.BASE_URL).
  // Hardcoding "/manifest.webmanifest" lies on subpath deploys (GitHub Pages
  // /solitaire/), and previously made the diagnostic itself misleading.
  const base = typeof import.meta !== "undefined" ? (import.meta.env?.BASE_URL || "/") : "/";
  const manifestLink = typeof document !== "undefined"
    ? document.querySelector('link[rel="manifest"]')
    : null;
  const manifestUrl = manifestLink?.href || (base + "manifest.webmanifest");
  const swUrl = base + "sw.js";

  const out = {
    base,
    manifestUrl,
    swUrl,
    https: typeof location !== "undefined" && location.protocol === "https:",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    displayMode: matchDisplayMode(),
    iosStandalone: typeof navigator !== "undefined" ? navigator.standalone : null,
    sw: { supported: typeof navigator !== "undefined" && "serviceWorker" in navigator, registrations: [], controller: null },
    manifest: null,
    icons: [],
  };

  try {
    const r = await fetch(manifestUrl, { cache: "no-cache" });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    out.manifest = {
      status: r.status,
      contentType: r.headers.get("content-type"),
      ok: r.ok,
      parsed: json,
      raw: text.slice(0, 800),
    };
    if (json?.icons?.length) {
      for (const icon of json.icons) {
        // Resolve icon.src against the manifest URL (spec behaviour).
        const iconUrl = new URL(icon.src, manifestUrl).toString();
        try {
          const ir = await fetch(iconUrl, { cache: "no-cache" });
          out.icons.push({
            ...icon, resolvedUrl: iconUrl,
            status: ir.status, ok: ir.ok,
            contentType: ir.headers.get("content-type"),
          });
        } catch (e) {
          out.icons.push({ ...icon, resolvedUrl: iconUrl, status: 0, error: String(e) });
        }
      }
    }
  } catch (e) {
    out.manifest = { error: String(e) };
  }

  if (out.sw.supported) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      out.sw.registrations = regs.map(r => ({
        scope: r.scope,
        scriptURL: r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || null,
        state: r.active?.state || r.installing?.state || r.waiting?.state || "none",
      }));
      out.sw.controller = navigator.serviceWorker.controller?.scriptURL || null;
    } catch (e) {
      out.sw.error = String(e);
    }
    try {
      const swr = await fetch(swUrl, { cache: "no-cache" });
      out.sw.fileStatus = swr.status;
      out.sw.fileContentType = swr.headers.get("content-type");
    } catch (e) {
      out.sw.fileError = String(e);
    }
  }

  return out;
}

function matchDisplayMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "unknown";
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return "minimal-ui";
  return "browser";
}
