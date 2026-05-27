import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Solitaire } from "./App.jsx";
import { InstallPill } from "./components/InstallPill.jsx";
import { PwaDiagnostics } from "./components/PwaDiagnostics.jsx";
import { MapEditor } from "./components/MapEditor.jsx";
import { hydrateMap, subscribeToMapUpdates, onMapUpdate } from "./data/handcrafted-map.js";

// Hash routing — `#/edit` swaps the main app for the handcrafted-map editor.
// Hash-based so it works under any deploy subpath without needing a real
// router. Everything else (including `#pwa` for the diagnostics panel) goes
// through the main Solitaire app.
//
// The handcrafted map is fetched from Supabase before either route mounts
// (see hydrateMap below) so the engine and the editor both read a populated
// HANDCRAFTED dict. Without this gate the engine would query an empty map
// on first paint and the editor would show nothing.
function Root() {
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Bump this on every applyMapData so React re-renders subtrees that
  // closure over HANDCRAFTED contents (the game's MapView mostly). The
  // engine reads HANDCRAFTED at draw time, so a key bump is enough to
  // force re-paint without rewriting every consumer to subscribe.
  const [, setMapVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    hydrateMap()
      .then(() => {
        if (!alive) return;
        setMapReady(true);
      })
      .catch((err) => { if (alive) setMapError(err); });
    return () => { alive = false; };
  }, []);

  // After hydrate succeeds, open a realtime channel for cross-tab sync
  // (editor saves in another tab repaint the game here without reload).
  // Also bump mapVersion on local applyMapData so the same-tab editor →
  // game flow works without a refresh.
  useEffect(() => {
    if (!mapReady) return;
    const unsub = subscribeToMapUpdates();
    const off = onMapUpdate(() => setMapVersion((v) => v + 1));
    return () => { unsub(); off(); };
  }, [mapReady]);

  if (mapError) {
    return (
      <div style={{
        padding: "24px", color: "#f5dcb8", fontFamily: "'Inter', sans-serif",
        backgroundColor: "#0c1111", minHeight: "100vh",
      }}>
        <h2 style={{ color: "#e58a7a" }}>Couldn't load the map</h2>
        <p style={{ marginTop: "8px", lineHeight: 1.5 }}>{String(mapError.message || mapError)}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: "12px", padding: "6px 14px", cursor: "pointer" }}
        >Retry</button>
      </div>
    );
  }

  if (!mapReady) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", color: "#f5dcb8",
        backgroundColor: "#0c1111", fontFamily: "'Inter', sans-serif",
      }}>
        Loading map…
      </div>
    );
  }

  if (hash === "#/edit") return <MapEditor onExit={() => { window.location.hash = ""; }} />;
  return (
    <>
      <Solitaire />
      {/* Floating PWA install pill — only renders once Chrome fires
          beforeinstallprompt. position: fixed so it floats over whatever
          screen is active. */}
      <InstallPill />
      {/* In-page diagnostic panel. Visit /#pwa on the phone to see why
          Chrome isn't classifying the site as installable. */}
      <PwaDiagnostics />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);

// Register the PWA service worker. Built with `import.meta.env.BASE_URL`
// so it works under any subpath deploy (e.g. GitHub Pages /solitaire/).
// Without this, register() would target the domain root and 404 on hosts
// that aren't root-deploys.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Registration is best-effort; install prompt simply won't appear.
    });
  });
}
