import React, { useEffect, useMemo, useRef } from "react";

export const TOW_COMBAT_FLIPBOOK_FRAME_COUNT = 9;
export const TOW_COMBAT_FLIPBOOK_FPS = 18;

const REDUCED_MOTION_DURATION_MS = 180;
const imageCache = new Map();

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function easeOut(value) {
  const t = clamp(value);
  return 1 - ((1 - t) ** 3);
}

function smoothstep(value) {
  const t = clamp(value);
  return t * t * (3 - (2 * t));
}

function frameRangeForCue(cue) {
  const authoredRange = cue?.visual?.flipbook?.frameRange;
  if (Array.isArray(authoredRange) && authoredRange.length === 2) {
    const start = clamp(Math.round(authoredRange[0]), 0, TOW_COMBAT_FLIPBOOK_FRAME_COUNT - 1);
    const end = clamp(Math.round(authoredRange[1]), start, TOW_COMBAT_FLIPBOOK_FRAME_COUNT - 1);
    return [start, end];
  }
  return [0, TOW_COMBAT_FLIPBOOK_FRAME_COUNT - 1];
}

function cueDuration(cue, reducedMotion) {
  if (reducedMotion) return REDUCED_MOTION_DURATION_MS;
  const [start, end] = frameRangeForCue(cue);
  return Math.max(170, ((end - start + 1) / TOW_COMBAT_FLIPBOOK_FPS) * 1_000);
}

function anchorForSide(cue, side, width, height) {
  const enemy = side === "enemy";
  const mobile = width < 620;
  const profile = cue.visual?.profile || {};
  const lane = Number.isFinite(cue.hitIndex) ? cue.hitIndex : 0;
  const xBase = enemy ? (mobile ? 0.72 : 0.77) : (mobile ? 0.28 : 0.23);
  const yBase = enemy ? (mobile ? 0.31 : 0.34) : (mobile ? 0.67 : 0.69);
  return {
    x: width * xBase
      + ((Number(profile.x) || 0) / 100) * width
      + ((lane % 3) - 1) * Math.min(24, width * 0.022),
    y: height * yBase
      + ((Number(profile.y) || 0) / 100) * height
      + ([0, -1, 1][lane % 3] || 0) * Math.min(16, height * 0.03),
    radius: Math.max(
      82,
      Math.min(width * (mobile ? 0.27 : 0.22), height * (mobile ? 0.36 : 0.34), 230),
    ),
  };
}

export function combatVfxPositionForCue(cue, width, height, progress = 1) {
  const target = anchorForSide(cue, cue.targetSide, width, height);
  const travels = cue.visual?.travel === "source-to-target"
    && cue.attackerId
    && cue.targetId
    && cue.attackerId !== cue.targetId
    && (cue.targetSide === "enemy" || cue.targetSide === "player");
  if (!travels) return { ...target, angle: 0, travelProgress: 1 };

  const sourceSide = cue.targetSide === "enemy" ? "player" : "enemy";
  const source = anchorForSide(cue, sourceSide, width, height);
  // Reach the target on frame five, leaving frames six through nine anchored to contact
  // and dissipation instead of letting a projectile grow in place over the victim.
  const travelProgress = smoothstep(clamp(progress / 0.52));
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const mirror = cue.targetSide === "enemy" ? 1 : -1;
  return {
    x: source.x + (dx * travelProgress),
    y: source.y + (dy * travelProgress),
    radius: target.radius,
    angle: Math.atan2(dy, dx) - (mirror < 0 ? Math.PI : 0),
    travelProgress,
  };
}

function imageForAsset(asset) {
  return imageCache.get(asset)?.image || null;
}

function preloadImage(asset) {
  if (!asset || typeof Image === "undefined") return Promise.resolve(null);
  const cached = imageCache.get(asset);
  if (cached) return cached.promise;

  const image = new Image();
  image.decoding = "async";
  const promise = new Promise((resolve) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
  });
  imageCache.set(asset, { image, promise });
  image.src = asset;
  return promise;
}

export function flipbookSupportsVisual(visual) {
  return Boolean(
    visual?.flipbook?.asset
    && visual.flipbook.frameCount === TOW_COMBAT_FLIPBOOK_FRAME_COUNT
    && visual.flipbook.layout === "horizontal",
  );
}

function frameAtProgress(cue, progress, reducedMotion) {
  if (reducedMotion) return 4;
  const [start, end] = frameRangeForCue(cue);
  return Math.min(end, start + Math.floor(clamp(progress) * (end - start + 1)));
}

function drawFramePass(ctx, image, source, destination, {
  alpha,
  composite,
  blur = 0,
  scale = 1,
}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  const width = destination.width * scale;
  const height = destination.height * scale;
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    destination.x - ((width - destination.width) / 2),
    destination.y - ((height - destination.height) / 2),
    width,
    height,
  );
  ctx.restore();
}

/** Draw one authored bitmap frame with a restrained additive glow under its raster core. */
export function drawCombatVfxCue(ctx, cue, image, width, height, progress, {
  reducedMotion = false,
} = {}) {
  const flipbook = cue?.visual?.flipbook;
  if (!flipbookSupportsVisual(cue?.visual) || !image) return false;

  const frame = frameAtProgress(cue, progress, reducedMotion);
  const sourceFrameWidth = (image.naturalWidth || image.width) / flipbook.frameCount;
  const sourceFrameHeight = image.naturalHeight || image.height;
  const anchor = combatVfxPositionForCue(cue, width, height, reducedMotion ? 1 : progress);
  const authoredScale = clamp(Number(cue.visual?.profile?.scale) || 1, 0.88, 1.12);
  const size = anchor.radius * 2.5 * authoredScale;
  const fade = reducedMotion ? 0.9 : 1 - easeOut((clamp(progress) - 0.82) / 0.18);
  const mirror = cue.targetSide === "enemy" ? 1 : -1;
  const source = {
    x: frame * sourceFrameWidth,
    y: 0,
    width: sourceFrameWidth,
    height: sourceFrameHeight,
  };
  const destination = { x: -size / 2, y: -size / 2, width: size, height: size };

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(anchor.angle);
  ctx.scale(mirror, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawFramePass(ctx, image, source, destination, {
    alpha: fade * 0.3,
    composite: "lighter",
    blur: Math.max(4, size * 0.022),
    scale: 1.025,
  });
  drawFramePass(ctx, image, source, destination, {
    alpha: fade,
    composite: "source-over",
  });
  ctx.restore();
  return true;
}

function canvasContext(canvas) {
  if (!canvas || typeof canvas.getContext !== "function") return null;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "")) return null;
  try {
    return canvas.getContext("2d", { alpha: true, desynchronized: true });
  } catch {
    return null;
  }
}

function resizeCanvas(canvas, ctx) {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || canvas.clientWidth || 1));
  const height = Math.max(1, Math.round(bounds.height || canvas.clientHeight || 1));
  const dpr = Math.max(1, Math.min(2.5, Number(globalThis.devicePixelRatio) || 1));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

function dedupeAuthoredCues(cues) {
  return cues.filter((cue, index) => {
    const id = cue.visual?.flipbook?.id;
    if (!id) return false;
    if ((cue.hitCount || 1) > 1) return true;
    return !cues.slice(0, index).some((prior) => (
      prior.visual?.flipbook?.id === id
      && prior.actionIndex === cue.actionIndex
      && prior.targetSide === cue.targetSide
    ));
  });
}

export function TowCombatVfxCanvas({ cues = [] }) {
  const canvasRef = useRef(null);
  const drawableCues = useMemo(() => dedupeAuthoredCues(cues), [cues]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvasContext(canvas);
    if (!ctx || drawableCues.length === 0) return undefined;

    let frame = null;
    let stopped = false;
    let dimensions = resizeCanvas(canvas, ctx);
    let observer = null;
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    const reducedMotion = Boolean(media?.matches);
    const assets = [...new Set(drawableCues.map((cue) => cue.visual.flipbook.asset))];

    const resize = () => {
      dimensions = resizeCanvas(canvas, ctx);
    };
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", resize);
    }

    Promise.all(assets.map(preloadImage)).then(() => {
      if (stopped) return;
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      const finalFrame = Math.max(...drawableCues.map((cue) => (
        (cue.delayMs || 0) + cueDuration(cue, reducedMotion)
      )));

      const render = (timestamp) => {
        if (stopped) return;
        const elapsed = timestamp - startedAt;
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        for (const cue of drawableCues) {
          const duration = cueDuration(cue, reducedMotion);
          const local = (elapsed - (cue.delayMs || 0)) / duration;
          if (local < 0 || local > 1) continue;
          const image = imageForAsset(cue.visual.flipbook.asset);
          drawCombatVfxCue(
            ctx,
            cue,
            image,
            dimensions.width,
            dimensions.height,
            local,
            { reducedMotion },
          );
        }
        if (elapsed <= finalFrame) frame = requestAnimationFrame(render);
        else ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      };
      frame = requestAnimationFrame(render);
    });

    return () => {
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer && typeof window !== "undefined") window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    };
  }, [drawableCues]);

  return (
    <canvas
      ref={canvasRef}
      className="tow-combat__vfx-canvas"
      data-testid="tow-combat-vfx-canvas"
      data-renderer="imagegen-flipbook"
      data-frame-count={TOW_COMBAT_FLIPBOOK_FRAME_COUNT}
      data-fps={TOW_COMBAT_FLIPBOOK_FPS}
      data-cue-count={cues.length}
      data-flipbook-count={drawableCues.length}
      aria-hidden="true"
    />
  );
}
