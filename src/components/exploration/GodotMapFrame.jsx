import React, { useEffect, useRef, useState } from "react";

const GODOT_MAP_URL = `${import.meta.env.BASE_URL}godot/index.html`;

function decodeMessage(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function GodotMapFrame({ scene, onSelect, label, choices = [], selectedKey = "" }) {
  const frameRef = useRef(null);
  const sceneRef = useRef(scene);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const ready = status === "ready";

  sceneRef.current = scene;

  function sendScene(nextScene = sceneRef.current) {
    const target = frameRef.current?.contentWindow;
    if (!target || !nextScene) return;
    target.postMessage(JSON.stringify({ type: "solitaire-map-scene", payload: nextScene }), window.location.origin);
  }

  useEffect(() => {
    function receive(event) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const message = decodeMessage(event.data);
      if (!message) return;
      if (message.type === "solitaire-godot-ready") {
        setStatus("ready");
        sendScene();
      } else if (message.type === "solitaire-godot-select" && message.key) {
        onSelect?.(message.key);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onSelect]);

  useEffect(() => {
    if (ready) sendScene(scene);
  }, [ready, scene]);

  useEffect(() => {
    if (status !== "loading") return undefined;
    const timer = window.setTimeout(() => setStatus((current) => current === "loading" ? "error" : current), 45000);
    return () => window.clearTimeout(timer);
  }, [status, attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((current) => current + 1);
  }

  const frameUrl = attempt ? `${GODOT_MAP_URL}?retry=${attempt}` : GODOT_MAP_URL;

  return (
    <div className={`godot-map-frame is-${status}`} role="group" aria-label={label}>
      <iframe
        key={attempt}
        ref={frameRef}
        src={frameUrl}
        title={label}
        onLoad={() => sendScene()}
        onError={() => setStatus("error")}
        scrolling="no"
        tabIndex="-1"
      />
      {choices.length > 0 && (
        <div className="godot-map-accessibility" aria-label={`${label} destinations`}>
          <span>Map destinations</span>
          {choices.map((choice) => (
            <button key={choice.key} onClick={() => onSelect?.(choice.key)} aria-pressed={choice.key === selectedKey}>{choice.label}</button>
          ))}
        </div>
      )}
      {!ready && (
        <div className={`godot-map-loading ${status === "error" ? "is-error" : ""}`} role={status === "error" ? "alert" : "status"}>
          <span>{status === "error" ? "!" : "◆"}</span>
          <b>{status === "error" ? "The map engine did not start" : "Drawing the living map"}</b>
          <small>{status === "error" ? "Direction controls and destination lists still work. Retry the Godot renderer when ready." : "Terrain, paths, and fog are syncing with the world state."}</small>
          {status === "error" && <button onClick={retry}>Retry map engine</button>}
        </div>
      )}
    </div>
  );
}
