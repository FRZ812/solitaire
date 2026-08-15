import React, { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const DEFAULT_DURATION_MS = 920;
const REDUCED_MOTION_DURATION_MS = 180;

const MOTION_DURATIONS = Object.freeze({
  afterimage: 640,
  barrage: 1_040,
  brace: 900,
  charge: 920,
  counter: 720,
  cyclone: 1_080,
  execution: 760,
  flurry: 820,
  fortress: 1_040,
  heavy: 980,
  inferno: 1_080,
  mend: 960,
  multi: 840,
  projectile: 720,
  quake: 1_040,
  radiant: 960,
  rapid: 620,
  snap: 640,
  summon: 1_060,
  volley: 920,
});

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function easeOut(value) {
  const t = clamp(value);
  return 1 - ((1 - t) ** 3);
}

function easeInOut(value) {
  const t = clamp(value);
  return t < 0.5 ? 4 * t * t * t : 1 - (((-2 * t) + 2) ** 3) / 2;
}

function phase(value, start, end) {
  return clamp((value - start) / Math.max(0.0001, end - start));
}

function pulse(value) {
  return Math.sin(clamp(value) * Math.PI);
}

function seeded(seed, index = 0) {
  let value = (Number(seed) || 1) ^ Math.imul(index + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function withStroke(ctx, {
  color,
  width = 0.045,
  alpha = 1,
  blur = 0.12,
  composite = "lighter",
}, draw) {
  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = typeof color === "string" ? color : "transparent";
  ctx.shadowBlur = typeof color === "string" ? blur : 0;
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
  ctx.restore();
}

function withFill(ctx, {
  color,
  alpha = 1,
  blur = 0.08,
  composite = "lighter",
}, draw) {
  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  ctx.shadowColor = typeof color === "string" ? color : "transparent";
  ctx.shadowBlur = typeof color === "string" ? blur : 0;
  ctx.beginPath();
  draw(ctx);
  ctx.fill();
  ctx.restore();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function curve(ctx, x1, y1, cx1, cy1, cx2, cy2, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
}

function polygon(ctx, sides, radius, rotation = 0) {
  for (let index = 0; index <= sides; index += 1) {
    const angle = rotation + (index / sides) * TAU;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function drawSparkField(state, {
  count = 8,
  radius = 0.72,
  length = 0.18,
  color = state.secondary,
  upward = false,
} = {}) {
  const { ctx, seed, t, alpha } = state;
  const reveal = easeOut(phase(t, 0.08, 0.82));
  for (let index = 0; index < count; index += 1) {
    const randomAngle = seeded(seed, index) * TAU;
    const angle = upward ? -Math.PI * (0.18 + seeded(seed, index + 19) * 0.64) : randomAngle;
    const travel = radius * reveal * (0.45 + seeded(seed, index + 7) * 0.55);
    const x = Math.cos(angle) * travel;
    const y = Math.sin(angle) * travel;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    withStroke(ctx, {
      color,
      width: 0.018 + seeded(seed, index + 31) * 0.018,
      alpha: alpha * (0.35 + seeded(seed, index + 11) * 0.55),
      blur: 0.08,
    }, (path) => line(path, x - dx, y - dy, x, y));
  }
}

function drawSweep(state, {
  angle = -0.62,
  count = 1,
  curvature = 0.12,
  spread = 0.14,
  reverse = false,
  color = state.primary,
  width = 0.065,
} = {}) {
  const { ctx, t, alpha, secondary } = state;
  const reveal = easeOut(phase(t, 0.02, 0.48));
  const linger = 1 - easeInOut(phase(t, 0.55, 1));
  for (let index = 0; index < count; index += 1) {
    const offset = (index - ((count - 1) / 2)) * spread;
    ctx.save();
    ctx.rotate(angle * (reverse ? -1 : 1));
    ctx.translate(0, offset);
    ctx.scale(reverse ? -1 : 1, 1);
    const endX = -0.9 + (1.8 * reveal);
    withStroke(ctx, {
      color: index === Math.floor(count / 2) ? color : secondary,
      width: width * (1 - index * 0.08),
      alpha: alpha * linger,
      blur: 0.18,
    }, (path) => curve(path, -0.9, 0.22, -0.38, -0.42 - curvature, 0.34, 0.42 + curvature, endX, -0.22));
    withStroke(ctx, {
      color: state.shadow,
      width: width * 1.75,
      alpha: alpha * linger * 0.3,
      blur: 0.28,
    }, (path) => curve(path, -0.86, 0.24, -0.34, -0.38, 0.3, 0.38, endX, -0.2));
    ctx.restore();
  }
  drawSparkField(state, { count: 5 + count, radius: 0.7, length: 0.12 });
}

function drawCross(state, options = {}) {
  drawSweep(state, { angle: -0.7, ...options });
  drawSweep({ ...state, t: phase(state.t, 0.12, 1) }, { angle: 0.72, reverse: true, ...options });
}

function drawProjectile(state, {
  count = 1,
  arc = 0,
  color = state.primary,
  fan = 0.16,
  vertical = false,
} = {}) {
  const { ctx, t, alpha, secondary } = state;
  const travel = easeInOut(phase(t, 0.02, 0.72));
  const fade = 1 - easeOut(phase(t, 0.7, 1));
  for (let index = 0; index < count; index += 1) {
    const offset = (index - ((count - 1) / 2)) * fan;
    ctx.save();
    if (vertical) ctx.rotate(Math.PI / 2);
    ctx.translate(0, offset);
    const headX = -1.05 + travel * 2.1;
    const headY = Math.sin(travel * Math.PI) * -arc;
    withStroke(ctx, {
      color: index % 2 ? secondary : color,
      width: 0.045,
      alpha: alpha * fade,
      blur: 0.16,
    }, (path) => curve(path, headX - 0.62, headY + arc * 0.35, headX - 0.38, headY + arc * 0.2, headX - 0.12, headY, headX, headY));
    withFill(ctx, { color, alpha: alpha * fade, blur: 0.12 }, (path) => {
      path.moveTo(headX + 0.13, headY);
      path.lineTo(headX - 0.1, headY - 0.07);
      path.lineTo(headX - 0.04, headY);
      path.lineTo(headX - 0.1, headY + 0.07);
      path.closePath();
    });
    ctx.restore();
  }
}

function drawRings(state, {
  count = 3,
  squash = 1,
  color = state.secondary,
  inward = false,
} = {}) {
  const { ctx, t, alpha } = state;
  for (let index = 0; index < count; index += 1) {
    const local = phase(t, index * 0.08, 0.88 + index * 0.03);
    const radius = inward ? 0.9 - easeOut(local) * 0.72 : 0.08 + easeOut(local) * 0.82;
    withStroke(ctx, {
      color: index === 0 ? state.primary : color,
      width: 0.035 - index * 0.004,
      alpha: alpha * pulse(local) * (1 - index * 0.12),
      blur: 0.15,
    }, (path) => {
      ctx.save();
      ctx.scale(1, squash);
      path.arc(0, 0, radius, 0, TAU);
      ctx.restore();
    });
  }
}

function drawImpact(state, { heavy = false, radiant = false } = {}) {
  drawRings(state, { count: heavy ? 4 : 3, squash: heavy ? 0.54 : 0.82 });
  const burst = easeOut(phase(state.t, 0.04, 0.55));
  const rays = heavy ? 14 : 9;
  for (let index = 0; index < rays; index += 1) {
    const angle = (index / rays) * TAU + seeded(state.seed, index) * 0.2;
    const inner = 0.08 + seeded(state.seed, index + 5) * 0.1;
    const outer = inner + burst * (0.34 + seeded(state.seed, index + 9) * 0.48);
    withStroke(state.ctx, {
      color: radiant && index % 2 ? "#ffe59a" : state.primary,
      width: 0.018 + seeded(state.seed, index + 13) * 0.025,
      alpha: state.alpha * (1 - easeOut(phase(state.t, 0.48, 1))),
      blur: 0.12,
    }, (path) => line(path, Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer));
  }
}

function drawGroundFracture(state) {
  const { ctx, t, alpha, seed } = state;
  const reveal = easeOut(phase(t, 0.08, 0.6));
  withStroke(ctx, { color: state.primary, width: 0.055, alpha, blur: 0.15 }, (path) => line(path, 0, -0.9, 0, -0.05));
  for (let index = 0; index < 9; index += 1) {
    const side = index % 2 ? 1 : -1;
    const x = side * (0.15 + seeded(seed, index) * 0.74) * reveal;
    const y = 0.18 + seeded(seed, index + 17) * 0.32;
    withStroke(ctx, { color: index % 3 ? state.secondary : state.primary, width: 0.025, alpha: alpha * pulse(t), blur: 0.09 }, (path) => {
      path.moveTo(0, 0.05);
      path.lineTo(x * 0.42, y * 0.55);
      path.lineTo(x, y);
      path.lineTo(x * 1.12, y + 0.18);
    });
  }
  drawRings({ ...state, t: phase(t, 0.2, 1) }, { count: 2, squash: 0.25 });
}

function drawFlames(state, { count = 6, curtain = false, hellfire = false } = {}) {
  const { ctx, t, alpha, seed } = state;
  const rise = easeOut(phase(t, 0, 0.82));
  for (let index = 0; index < count; index += 1) {
    const x = curtain
      ? -0.82 + (index / Math.max(1, count - 1)) * 1.64
      : (seeded(seed, index) - 0.5) * 1.15;
    const height = (0.45 + seeded(seed, index + 13) * 0.58) * rise;
    const sway = (seeded(seed, index + 29) - 0.5) * 0.42;
    withStroke(ctx, {
      color: hellfire && index % 2 ? "#b653ff" : index % 2 ? state.secondary : state.primary,
      width: 0.045 + seeded(seed, index + 2) * 0.04,
      alpha: alpha * pulse(phase(t, index * 0.02, 1)),
      blur: 0.2,
    }, (path) => curve(path, x, 0.72, x - sway, 0.28, x + sway, -0.05, x + sway * 0.2, 0.72 - height * 1.65));
  }
  drawSparkField(state, { count: count + 4, radius: 0.75, length: 0.1, upward: true });
}

function drawVortex(state, { inward = false, tendrils = 4, vertical = false } = {}) {
  const { ctx, t, alpha } = state;
  const rotation = (inward ? -1 : 1) * easeInOut(t) * Math.PI * 1.6;
  for (let index = 0; index < tendrils; index += 1) {
    const start = rotation + (index / tendrils) * TAU;
    withStroke(ctx, {
      color: index % 2 ? state.secondary : state.primary,
      width: 0.035 + (index % 2) * 0.015,
      alpha: alpha * pulse(phase(t, index * 0.025, 1)),
      blur: 0.16,
    }, (path) => {
      for (let step = 0; step <= 24; step += 1) {
        const portion = step / 24;
        const radius = inward ? 0.9 * (1 - portion * 0.9) : 0.12 + portion * 0.78;
        const angle = start + portion * Math.PI * 2.1;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * (vertical ? 1.15 : 0.72);
        if (step === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
    });
  }
}

function drawWisps(state, { toxic = false, sleep = false, count = 9 } = {}) {
  const { ctx, t, alpha, seed } = state;
  for (let index = 0; index < count; index += 1) {
    const delay = (index % 4) * 0.06;
    const local = phase(t, delay, 1);
    const x = (seeded(seed, index) - 0.5) * 1.35 + Math.sin(local * 4 + index) * 0.12;
    const y = 0.75 - local * (0.9 + seeded(seed, index + 13) * 0.65);
    const radius = 0.035 + seeded(seed, index + 31) * 0.085;
    withStroke(ctx, {
      color: index % 2 ? state.secondary : state.primary,
      width: 0.018,
      alpha: alpha * pulse(local) * 0.86,
      blur: 0.11,
    }, (path) => path.arc(x, y, radius, sleep ? 0.22 * Math.PI : 0, sleep ? 1.7 * Math.PI : TAU));
    if (toxic && index % 3 === 0) {
      withFill(ctx, { color: state.secondary, alpha: alpha * pulse(local) * 0.22, blur: 0.1 }, (path) => path.arc(x, y, radius * 0.72, 0, TAU));
    }
  }
}

function drawLightning(state, { bind = false, branches = 4 } = {}) {
  const { ctx, t, alpha, seed } = state;
  const flicker = 0.48 + Math.abs(Math.sin(t * Math.PI * 11)) * 0.52;
  if (bind) drawRings(state, { count: 3, squash: 0.72, inward: true });
  for (let branch = 0; branch < branches; branch += 1) {
    const angle = bind ? (branch / branches) * TAU : -0.8 + branch * 0.42;
    const length = bind ? 0.78 : 1.08;
    withStroke(ctx, { color: branch % 2 ? state.secondary : state.primary, width: 0.028, alpha: alpha * flicker, blur: 0.18 }, (path) => {
      for (let step = 0; step <= 8; step += 1) {
        const portion = step / 8;
        const jitter = (seeded(seed + branch, step) - 0.5) * 0.16;
        const radius = bind ? length * (1 - portion * 0.8) : length * portion;
        const x = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * jitter;
        const y = Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * jitter;
        if (step === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
    });
  }
}

function drawWard(state, { fortress = false, bone = false, mirror = false } = {}) {
  const { ctx, t, alpha } = state;
  const reveal = easeOut(phase(t, 0.02, 0.45));
  const fade = 1 - easeOut(phase(t, 0.7, 1));
  const segments = fortress ? 6 : 3;
  for (let index = 0; index < segments; index += 1) {
    const angle = -Math.PI * 0.9 + (index / Math.max(1, segments - 1)) * Math.PI * 0.8;
    const radius = 0.62 + index * 0.045;
    withStroke(ctx, {
      color: index % 2 ? state.secondary : state.primary,
      width: fortress ? 0.045 : 0.055,
      alpha: alpha * fade,
      blur: 0.18,
    }, (path) => path.arc(0, 0.14, radius * reveal, angle, angle + Math.PI * (fortress ? 0.72 : 1.02)));
  }
  if (fortress || mirror) {
    withStroke(ctx, { color: state.primary, width: 0.025, alpha: alpha * fade * 0.7, blur: 0.1 }, (path) => polygon(path, 6, 0.72 * reveal, Math.PI / 6));
  }
  if (bone) {
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU + t * 0.9;
      ctx.save();
      ctx.rotate(angle);
      withStroke(ctx, { color: index % 2 ? state.secondary : state.primary, width: 0.07, alpha: alpha * fade, blur: 0.1 }, (path) => line(path, 0.5, -0.1, 0.78, 0.1));
      ctx.restore();
    }
  }
}

function drawThorns(state) {
  const { ctx, t, alpha, seed } = state;
  const grow = easeOut(phase(t, 0.02, 0.72));
  for (let index = 0; index < 9; index += 1) {
    const angle = -Math.PI * (0.08 + (index / 10) * 0.84);
    const length = grow * (0.5 + seeded(seed, index) * 0.48);
    const bend = (seeded(seed, index + 9) - 0.5) * 0.32;
    withStroke(ctx, { color: index % 3 ? state.secondary : state.primary, width: 0.035 + seeded(seed, index + 18) * 0.03, alpha: alpha * pulse(t), blur: 0.11 }, (path) => {
      const x = Math.cos(angle) * length;
      const y = 0.72 + Math.sin(angle) * length;
      curve(path, 0, 0.72, Math.cos(angle) * length * 0.35 + bend, 0.5, Math.cos(angle) * length * 0.72 - bend, 0.2, x, y);
    });
    const tipX = Math.cos(angle) * length;
    const tipY = 0.72 + Math.sin(angle) * length;
    withFill(ctx, { color: state.primary, alpha: alpha * pulse(t), blur: 0.08 }, (path) => {
      path.moveTo(tipX, tipY);
      path.lineTo(tipX - Math.cos(angle - 0.5) * 0.15, tipY - Math.sin(angle - 0.5) * 0.15);
      path.lineTo(tipX - Math.cos(angle + 0.5) * 0.15, tipY - Math.sin(angle + 0.5) * 0.15);
      path.closePath();
    });
  }
}

function drawShatter(state, { target = false, cripple = false } = {}) {
  const { ctx, t, alpha, seed } = state;
  const explode = easeOut(phase(t, 0.08, 0.7));
  if (target) {
    drawRings(state, { count: 2, squash: 1 });
    withStroke(ctx, { color: state.primary, width: 0.035, alpha, blur: 0.12 }, (path) => {
      line(path, -0.85, 0, -0.28, 0);
      line(path, 0.28, 0, 0.85, 0);
      line(path, 0, -0.85, 0, -0.28);
      line(path, 0, 0.28, 0, 0.85);
    });
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * TAU + seeded(seed, index) * 0.18;
    const distance = explode * (0.22 + seeded(seed, index + 12) * 0.67);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance * (cripple ? 0.52 : 1);
    const size = 0.055 + seeded(seed, index + 24) * 0.11;
    withFill(ctx, { color: index % 2 ? state.secondary : state.primary, alpha: alpha * pulse(t), blur: 0.08 }, (path) => {
      path.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
      path.lineTo(x + Math.cos(angle + 2.2) * size * 0.65, y + Math.sin(angle + 2.2) * size * 0.65);
      path.lineTo(x + Math.cos(angle - 2.1) * size * 0.45, y + Math.sin(angle - 2.1) * size * 0.45);
      path.closePath();
    });
  }
}

function drawTendrils(state, { inward = false, count = 5, crimson = false } = {}) {
  const { ctx, t, alpha, seed } = state;
  const reach = easeInOut(phase(t, 0.02, 0.8));
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU + seeded(seed, index) * 0.4;
    const outerX = Math.cos(angle) * (0.82 + seeded(seed, index + 10) * 0.2);
    const outerY = Math.sin(angle) * 0.72;
    const startX = inward ? outerX : 0;
    const startY = inward ? outerY : 0;
    const endX = inward ? outerX * (1 - reach) : outerX * reach;
    const endY = inward ? outerY * (1 - reach) : outerY * reach;
    withStroke(ctx, { color: crimson && index % 2 ? "#ff355f" : index % 2 ? state.secondary : state.primary, width: 0.035 + seeded(seed, index + 20) * 0.04, alpha: alpha * pulse(t), blur: 0.17 }, (path) => curve(path, startX, startY, outerX * 0.2 - outerY * 0.32, outerY * 0.25, outerX * 0.65 + outerY * 0.22, outerY * 0.8, endX, endY));
  }
}

function drawRise(state, { pillar = false, calm = false, gears = false } = {}) {
  const { ctx, t, alpha, seed } = state;
  const rise = easeOut(phase(t, 0.02, 0.75));
  if (pillar) {
    const gradient = ctx.createLinearGradient(0, 0.9, 0, -0.95);
    gradient.addColorStop(0, state.secondary);
    gradient.addColorStop(0.48, state.primary);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    withFill(ctx, { color: gradient, alpha: alpha * 0.48, blur: 0.22 }, (path) => path.rect(-0.16 - rise * 0.08, 0.8, 0.32 + rise * 0.16, -1.65 * rise));
  }
  for (let index = 0; index < 10; index += 1) {
    const x = (seeded(seed, index) - 0.5) * (calm ? 0.8 : 1.3);
    const y = 0.82 - rise * (0.55 + seeded(seed, index + 10) * 1.12);
    const radius = 0.025 + seeded(seed, index + 22) * 0.055;
    withFill(ctx, { color: index % 2 ? state.secondary : state.primary, alpha: alpha * pulse(phase(t, index * 0.025, 1)), blur: 0.1 }, (path) => path.arc(x, y, radius, 0, TAU));
  }
  if (gears) {
    withStroke(ctx, { color: state.secondary, width: 0.035, alpha: alpha * pulse(t), blur: 0.12 }, (path) => polygon(path, 10, 0.46 + rise * 0.16, t * 1.2));
  }
  if (calm) drawRings(state, { count: 3, squash: 0.48 });
}

function drawGlyph(state, { clock = false, forbidden = false, target = false } = {}) {
  const { ctx, t, alpha } = state;
  const reveal = easeOut(phase(t, 0.02, 0.55));
  ctx.save();
  ctx.rotate((forbidden ? -1 : 1) * t * 0.8);
  withStroke(ctx, { color: state.secondary, width: 0.032, alpha: alpha * pulse(t), blur: 0.15 }, (path) => {
    path.arc(0, 0, 0.68 * reveal, 0, TAU);
    polygon(path, forbidden ? 5 : clock ? 12 : 6, 0.5 * reveal, forbidden ? -Math.PI / 2 : 0);
  });
  ctx.restore();
  if (clock) {
    const angle = -Math.PI / 2 + t * TAU * 1.5;
    withStroke(ctx, { color: state.primary, width: 0.045, alpha, blur: 0.15 }, (path) => {
      line(path, 0, 0, Math.cos(angle) * 0.38, Math.sin(angle) * 0.38);
      line(path, 0, 0, Math.cos(angle * 0.42) * 0.27, Math.sin(angle * 0.42) * 0.27);
    });
  }
  if (target) drawShatter({ ...state, t: phase(t, 0.2, 1) }, { target: true });
  drawSparkField(state, { count: forbidden ? 10 : 6, radius: 0.72, length: 0.08 });
}

function drawChains(state, { downward = false } = {}) {
  const { ctx, t, alpha } = state;
  const tighten = easeInOut(phase(t, 0.05, 0.72));
  for (let chain = 0; chain < 3; chain += 1) {
    const y = -0.36 + chain * 0.36 + (downward ? tighten * 0.22 : 0);
    for (let link = 0; link < 7; link += 1) {
      const x = -0.82 + link * 0.27;
      ctx.save();
      ctx.translate(x * (1 - tighten * 0.24), y);
      ctx.rotate((link + chain) % 2 ? 0.5 : -0.5);
      ctx.scale(1, 0.58);
      withStroke(ctx, { color: chain % 2 ? state.secondary : state.primary, width: 0.026, alpha: alpha * pulse(t), blur: 0.08 }, (path) => path.arc(0, 0, 0.11, 0, TAU));
      ctx.restore();
    }
  }
}

function drawAfterimage(state, { speed = false, mirror = false } = {}) {
  const { ctx, t, alpha } = state;
  const travel = easeOut(phase(t, 0.02, 0.78));
  for (let index = 0; index < (speed ? 7 : 4); index += 1) {
    const offset = (index - 1.5) * 0.24 - travel * 0.5;
    withStroke(ctx, { color: index % 2 ? state.secondary : state.primary, width: 0.028, alpha: alpha * (0.7 - index * 0.07), blur: 0.12 }, (path) => curve(path, 0.82 + offset, -0.62 + index * 0.04, 0.26 + offset, -0.34, -0.2 + offset, 0.22, -0.78 + offset, 0.58));
  }
  if (mirror) {
    ctx.save();
    ctx.scale(-1, 1);
    withStroke(ctx, { color: state.primary, width: 0.035, alpha: alpha * pulse(t) * 0.7, blur: 0.16 }, (path) => curve(path, 0.72, -0.62, 0.3, -0.28, -0.12, 0.18, -0.72, 0.58));
    ctx.restore();
  }
}

function drawFocus(state) {
  drawRings(state, { count: 2, squash: 1, inward: true });
  const { ctx, t, alpha } = state;
  const flare = pulse(phase(t, 0.05, 0.72));
  withStroke(ctx, { color: state.primary, width: 0.035, alpha: alpha * flare, blur: 0.22 }, (path) => {
    line(path, -0.78, 0, 0.78, 0);
    line(path, 0, -0.78, 0, 0.78);
  });
  withFill(ctx, { color: "#ffffff", alpha: alpha * flare, blur: 0.24 }, (path) => path.arc(0, 0, 0.08, 0, TAU));
}

function drawBite(state, { maw = false } = {}) {
  const { ctx, t, alpha } = state;
  const close = easeInOut(phase(t, 0.02, 0.62));
  const gap = (1 - close) * 0.72 + 0.08;
  withStroke(ctx, { color: state.primary, width: maw ? 0.09 : 0.06, alpha: alpha * pulse(t), blur: 0.2 }, (path) => {
    curve(path, -0.72, -gap, -0.28, -0.08 - gap, 0.28, -0.08 - gap, 0.72, -gap);
    curve(path, -0.72, gap, -0.28, 0.08 + gap, 0.28, 0.08 + gap, 0.72, gap);
  });
  if (!maw) {
    withFill(ctx, { color: state.primary, alpha: alpha * pulse(t), blur: 0.12 }, (path) => {
      path.moveTo(-0.32, -gap);
      path.lineTo(-0.1, 0);
      path.lineTo(0.02, -gap);
      path.closePath();
      path.moveTo(0.32, gap);
      path.lineTo(0.1, 0);
      path.lineTo(-0.02, gap);
      path.closePath();
    });
  }
}

function drawBloodRain(state) {
  drawProjectile(state, { count: 6, fan: 0.22, vertical: true, color: state.secondary });
  drawWisps({ ...state, t: phase(state.t, 0.24, 1) }, { count: 7 });
}

function drawBackflow(state) {
  drawProjectile({ ...state, t: 1 - state.t }, { count: 3, fan: 0.13, color: state.secondary });
  drawRings(state, { count: 2, inward: true, squash: 0.68 });
}

function drawMetamorphosis(state) {
  drawAfterimage(state, { mirror: true });
  const { ctx, t, alpha } = state;
  const burst = easeOut(phase(t, 0.25, 0.86));
  for (let index = 0; index < 7; index += 1) {
    const angle = -Math.PI + (index / 6) * Math.PI;
    const x = Math.cos(angle) * burst * 0.85;
    const y = Math.sin(angle) * burst * 0.55;
    withFill(ctx, { color: index % 2 ? state.shadow : state.secondary, alpha: alpha * pulse(t), blur: 0.09 }, (path) => {
      path.moveTo(x, y);
      path.lineTo(x - 0.12, y - 0.08);
      path.lineTo(x - 0.04, y + 0.02);
      path.lineTo(x + 0.1, y - 0.05);
      path.closePath();
    });
  }
}

function drawTimeWarp(state) {
  drawGlyph(state, { clock: true });
  drawVortex({ ...state, t: phase(state.t, 0.12, 1) }, { tendrils: 3, inward: true });
}

function drawGear(state) {
  drawRise(state, { gears: true });
  const { ctx, t, alpha } = state;
  ctx.save();
  ctx.rotate(-t * 1.8);
  withStroke(ctx, { color: state.primary, width: 0.045, alpha: alpha * pulse(t), blur: 0.14 }, (path) => polygon(path, 8, 0.72, Math.PI / 8));
  ctx.restore();
}

function drawBeam(state, { vertical = false, railgun = false } = {}) {
  const { ctx, t, alpha } = state;
  const reveal = easeInOut(phase(t, 0.02, 0.42));
  const fade = 1 - easeOut(phase(t, 0.68, 1));
  ctx.save();
  if (vertical) ctx.rotate(Math.PI / 2);
  withStroke(ctx, { color: state.shadow, width: railgun ? 0.2 : 0.16, alpha: alpha * fade * 0.45, blur: 0.34 }, (path) => line(path, -1.15, 0, -1.15 + 2.3 * reveal, 0));
  withStroke(ctx, { color: state.primary, width: railgun ? 0.07 : 0.045, alpha: alpha * fade, blur: 0.2 }, (path) => line(path, -1.15, 0, -1.15 + 2.3 * reveal, 0));
  ctx.restore();
  drawSparkField(state, { count: railgun ? 12 : 7, radius: 0.72, length: 0.16 });
}

function drawExplosion(state, { toxic = false, frost = false } = {}) {
  drawImpact(state, { heavy: true });
  drawShatter({ ...state, t: phase(state.t, 0.08, 1) }, { cripple: frost });
  if (toxic) drawWisps({ ...state, t: phase(state.t, 0.18, 1) }, { toxic: true, count: 7 });
}

const renderers = Object.freeze({
  "aegis-radiance": (state) => { drawWard(state, { fortress: true }); drawRise(state, { pillar: true }); },
  "afterimage-dash": (state) => drawAfterimage(state),
  "ancestral-current": (state) => { drawVortex(state, { tendrils: 3 }); drawGlyph(state); },
  "arcane-trace": (state) => drawGlyph(state),
  "armor-break": (state) => { drawProjectile(state); drawShatter({ ...state, t: phase(state.t, 0.18, 1) }); },
  "aura-current": (state) => drawRise(state, { calm: true }),
  "awakening-burst": (state) => { drawImpact(state, { heavy: true }); drawRise(state, { pillar: true }); },
  "ballistic-burst": (state) => drawProjectile(state, { count: 5, fan: 0.12 }),
  "beam-line": (state) => drawBeam(state),
  "binding-lines": (state) => drawChains(state),
  "bite-collapse": (state) => drawBite(state),
  "blood-backflow": (state) => drawBackflow(state),
  "blood-drip": (state) => { drawSweep(state, { angle: -0.72, width: 0.075 }); drawWisps({ ...state, t: phase(state.t, 0.3, 1) }, { count: 6 }); },
  "blood-lance": (state) => drawProjectile(state, { count: 1, color: state.secondary }),
  "blood-maelstrom": (state) => drawVortex(state, { tendrils: 6 }),
  "blood-orbit": (state) => { drawRings(state, { count: 3, squash: 0.75, inward: true }); drawWisps(state, { count: 8 }); },
  "blood-rain": (state) => drawBloodRain(state),
  "blood-ward": (state) => drawWard(state, { fortress: true }),
  "bone-ward": (state) => drawWard(state, { bone: true }),
  "charge-surge": (state) => { drawLightning(state, { branches: 5 }); drawRings(state, { inward: true }); },
  "charge-current": (state) => { drawLightning(state, { branches: 4 }); drawRings(state, { inward: true }); },
  "claw-trails": (state) => drawSweep(state, { angle: -0.7, count: 3, spread: 0.2, width: 0.055 }),
  "confusion-swirl": (state) => { drawVortex(state, { tendrils: 3 }); drawRings(state, { count: 2, squash: 0.62 }); },
  "counter-sweep": (state) => { drawWard({ ...state, t: phase(state.t, 0, 0.5) }); drawSweep({ ...state, t: phase(state.t, 0.24, 1) }, { angle: 0.62, reverse: true }); },
  "cripple-shatter": (state) => drawShatter(state, { cripple: true }),
  "cruel-tendrils": (state) => drawTendrils(state, { inward: true, crimson: true }),
  "curtain-rise": (state) => drawFlames(state, { count: 9, curtain: true }),
  "death-claw-slash": (state) => drawSweep(state, { angle: -0.64, count: 3, color: "#db2777" }),
  "devour-collapse": (state) => drawBite(state, { maw: true }),
  "doom-collapse": (state) => { drawVortex(state, { inward: true, tendrils: 5 }); drawRings(state, { inward: true }); },
  "ember-sweep": (state) => { drawSweep(state, { color: state.secondary }); drawFlames({ ...state, t: phase(state.t, 0.18, 1) }, { count: 4 }); },
  "execution-line": (state) => drawSweep(state, { angle: -0.78, width: 0.035, curvature: 0.01 }),
  "explosion-burst": (state) => drawExplosion(state),
  "fate-clock": (state) => drawGlyph(state, { clock: true }),
  "fate-threads": (state) => drawTendrils(state, { inward: true, count: 7, crimson: true }),
  "flash-cut": (state) => { drawBeam(state); drawSweep({ ...state, t: phase(state.t, 0.1, 1) }, { angle: 0, width: 0.028, curvature: 0 }); },
  "flame-rise": (state) => drawFlames(state),
  "focus-gleam": (state) => drawFocus(state),
  "forbidden-glyph": (state) => drawGlyph(state, { forbidden: true }),
  "forcefield-grid": (state) => drawWard(state, { fortress: true }),
  "fortress-barrier": (state) => drawWard(state, { fortress: true }),
  "frost-shatter": (state) => drawExplosion(state, { frost: true }),
  "frost-sweep": (state) => { drawSweep(state); drawShatter({ ...state, t: phase(state.t, 0.22, 1) }); },
  "gear-surge": (state) => drawGear(state),
  "ground-fracture": (state) => drawGroundFracture(state),
  "growth-rings": (state) => { drawRings(state, { count: 4, squash: 0.48 }); drawRise(state, { calm: true }); },
  "haste-streak": (state) => drawAfterimage(state, { speed: true }),
  "heart-pierce": (state) => { drawProjectile(state); drawImpact({ ...state, t: phase(state.t, 0.28, 1) }, { heavy: true }); },
  "heavy-sweep": (state) => drawSweep(state, { angle: 0.82, width: 0.1, curvature: 0.2 }),
  "hellfire-rise": (state) => drawFlames(state, { count: 8, hellfire: true }),
  "hunger-pulse": (state) => { drawRings(state, { count: 4 }); drawTendrils({ ...state, t: phase(state.t, 0.18, 1) }, { inward: true, crimson: true }); },
  "ice-spikes": (state) => drawShatter(state),
  "impact-rings": (state) => drawImpact(state),
  "impact-stagger": (state) => { drawImpact(state); drawRings(state, { count: 3, squash: 0.5 }); },
  "judgment-pillar": (state) => { drawBeam(state, { vertical: true }); drawImpact({ ...state, t: phase(state.t, 0.28, 1) }, { radiant: true }); },
  "knife-combo": (state) => drawCross(state, { width: 0.04 }),
  "lethargy-shackle": (state) => drawChains(state, { downward: true }),
  "lightning-bind": (state) => drawLightning(state, { bind: true, branches: 6 }),
  "lightning-fork": (state) => drawLightning(state, { branches: 5 }),
  "limp-drag": (state) => drawSweep(state, { angle: 0.18, reverse: true, width: 0.045, count: 2 }),
  "low-sweep": (state) => drawSweep(state, { angle: -0.12, curvature: -0.2 }),
  "metamorphosis-split": (state) => drawMetamorphosis(state),
  "mirror-shimmer": (state) => { drawAfterimage(state, { mirror: true }); drawWard(state, { mirror: true }); },
  "mist-disperse": (state) => { drawAfterimage(state); drawWisps(state, { count: 11 }); },
  "nanite-swarm": (state) => drawWisps(state, { count: 16 }),
  "orbital-pillar": (state) => { drawBeam(state, { vertical: true }); drawRings({ ...state, t: phase(state.t, 0.2, 1) }, { count: 4, squash: 0.28 }); },
  "overload-spark": (state) => { drawLightning(state, { branches: 8 }); drawImpact(state); },
  "poison-wisp": (state) => drawWisps(state, { toxic: true, count: 11 }),
  "projectile-barrage": (state) => drawProjectile(state, { count: 5, fan: 0.17, arc: 0.12 }),
  "projectile-line": (state) => drawProjectile(state),
  "projectile-rain": (state) => drawProjectile(state, { count: 6, fan: 0.19, vertical: true }),
  "radiant-fall": (state) => { drawBeam(state, { vertical: true }); drawRise(state, { pillar: true }); },
  "rage-surge": (state) => { drawFlames(state, { count: 7 }); drawImpact(state, { heavy: true }); },
  "rampage-combo": (state) => { drawCross(state, { width: 0.075 }); drawProjectile({ ...state, t: phase(state.t, 0.22, 1) }, { color: state.secondary }); },
  "railgun-line": (state) => drawBeam(state, { railgun: true }),
  "regeneration-rise": (state) => drawRise(state, { calm: true }),
  "rolling-wave": (state) => { drawVortex(state, { tendrils: 3 }); drawSweep(state, { angle: -0.14, curvature: 0.34 }); },
  "sever-line": (state) => drawSweep(state, { angle: 0, width: 0.035, curvature: 0 }),
  "shadow-combo": (state) => { drawAfterimage(state, { mirror: true }); drawCross(state, { color: state.secondary, width: 0.04 }); },
  "shadow-lunge": (state) => { drawAfterimage(state); drawProjectile(state, { color: state.secondary }); },
  "silencing-line": (state) => { drawBeam(state); drawRings(state, { inward: true, count: 2 }); },
  "single-sweep": (state) => drawSweep(state),
  "siphon-stream": (state) => { drawTendrils(state, { inward: true, crimson: true }); drawWisps(state, { count: 6 }); },
  "sleep-drift": (state) => drawWisps(state, { sleep: true, count: 8 }),
  "soul-shockwave": (state) => drawRings(state, { count: 5, squash: 0.68 }),
  "strike-combo": (state) => drawCross(state),
  "summon-rise": (state) => { drawGlyph(state); drawRise(state, { pillar: false }); },
  "thorn-growth": (state) => drawThorns(state),
  "time-warp": (state) => drawTimeWarp(state),
  "toxic-burst": (state) => drawExplosion(state, { toxic: true }),
  "unyielding-rise": (state) => { drawRise(state, { pillar: true }); drawWard(state, { fortress: true }); },
  "void-tendrils": (state) => drawTendrils(state, { inward: false, count: 7 }),
  "vulnerable-target": (state) => drawShatter(state, { target: true }),
  "ward-arc": (state) => drawWard(state),
  "wind-spiral": (state) => drawVortex(state, { tendrils: 5, vertical: true }),
  "wound-rip": (state) => drawCross(state, { width: 0.075, curvature: 0.18 }),
});

const comboRenderers = Object.freeze({
  "blood-drop-cross": renderers["blood-rain"],
  "blood-drop-left": renderers["blood-rain"],
  "blood-drop-right": renderers["blood-rain"],
  "blood-sweep-left": renderers["single-sweep"],
  "blood-sweep-right": (state) => drawSweep(state, { reverse: true }),
  "combo-cross": renderers["cross-cut"] || ((state) => drawCross(state)),
  "combo-left": renderers["single-sweep"],
  "combo-right": (state) => drawSweep(state, { reverse: true }),
  "combo-thrust": renderers["projectile-line"],
  "knife-cross": (state) => drawCross(state, { width: 0.04 }),
  "knife-left": (state) => drawSweep(state, { angle: -0.72, width: 0.04 }),
  "knife-right": (state) => drawSweep(state, { angle: 0.72, reverse: true, width: 0.04 }),
  "knife-thrust": renderers["projectile-line"],
  "projectile-center": renderers["projectile-line"],
  "projectile-cross": (state) => drawProjectile(state, { count: 2, fan: 0.28 }),
  "projectile-high": (state) => drawProjectile(state, { arc: 0.22 }),
  "projectile-low": (state) => drawProjectile(state, { arc: -0.16 }),
  "shadow-cross": renderers["shadow-combo"],
  "shadow-left": renderers["shadow-lunge"],
  "shadow-right": (state) => { state.ctx.save(); state.ctx.scale(-1, 1); renderers["shadow-lunge"](state); state.ctx.restore(); },
  "shadow-thrust": renderers["projectile-line"],
});

const ALL_RENDERERS = Object.freeze({
  ...renderers,
  "cross-cut": (state) => drawCross(state),
  ...comboRenderers,
});

export const TOW_COMBAT_CANVAS_CHOREOGRAPHIES = Object.freeze(Object.keys(ALL_RENDERERS).sort());

export function canvasSupportsChoreography(choreography) {
  return Object.hasOwn(ALL_RENDERERS, choreography);
}

function cueDuration(cue, reducedMotion) {
  if (reducedMotion) return REDUCED_MOTION_DURATION_MS;
  return MOTION_DURATIONS[cue?.visual?.motion] || DEFAULT_DURATION_MS;
}

function anchorForCue(cue, width, height) {
  const enemy = cue.targetSide === "enemy";
  const mobile = width < 620;
  const profile = cue.visual?.profile || {};
  const lane = Number.isFinite(cue.hitIndex) ? cue.hitIndex : 0;
  const xBase = enemy ? (mobile ? 0.72 : 0.77) : (mobile ? 0.28 : 0.23);
  const yBase = enemy ? (mobile ? 0.31 : 0.34) : (mobile ? 0.67 : 0.69);
  return {
    x: width * xBase + ((Number(profile.x) || 0) / 100) * width + ((lane % 3) - 1) * Math.min(28, width * 0.025),
    y: height * yBase + ((Number(profile.y) || 0) / 100) * height + ([0, -1, 1][lane % 3] || 0) * Math.min(18, height * 0.035),
    radius: Math.max(64, Math.min(width * (mobile ? 0.22 : 0.18), height * (mobile ? 0.3 : 0.27), 190)),
  };
}

export function drawCombatVfxCue(ctx, cue, width, height, progress, { reducedMotion = false } = {}) {
  const visual = cue?.visual;
  const renderer = ALL_RENDERERS[visual?.choreography];
  if (!renderer || !visual) return false;
  const anchor = anchorForCue(cue, width, height);
  const profile = visual.profile || {};
  const palette = visual.palette || {};
  const t = reducedMotion ? 0.46 : clamp(progress);
  const alpha = reducedMotion ? 0.92 : pulse(t);

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.scale(
    anchor.radius * (Number(profile.scale) || 1) * (Number(profile.mirror) || 1),
    anchor.radius * (Number(profile.scale) || 1),
  );
  ctx.rotate(((Number(profile.rotate) || 0) * Math.PI) / 180);
  renderer({
    ctx,
    t,
    alpha,
    seed: Number(profile.seed) || 1,
    primary: palette.primary || "#fff6de",
    secondary: palette.secondary || "#ef8d6a",
    shadow: palette.shadow || "#391311",
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
  return { width, height, dpr };
}

export function TowCombatVfxCanvas({ cues = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvasContext(canvas);
    if (!ctx || cues.length === 0) return undefined;

    let frame = null;
    let stopped = false;
    let dimensions = resizeCanvas(canvas, ctx);
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    const reducedMotion = Boolean(media?.matches);
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const finalFrame = Math.max(...cues.map((cue) => (cue.delayMs || 0) + cueDuration(cue, reducedMotion)));

    const resize = () => {
      dimensions = resizeCanvas(canvas, ctx);
    };
    let observer = null;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", resize);
    }

    const render = (timestamp) => {
      if (stopped) return;
      const elapsed = timestamp - startedAt;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      for (const cue of cues) {
        const duration = cueDuration(cue, reducedMotion);
        const local = (elapsed - (cue.delayMs || 0)) / duration;
        if (local < 0 || local > 1) continue;
        drawCombatVfxCue(ctx, cue, dimensions.width, dimensions.height, local, { reducedMotion });
      }
      if (elapsed <= finalFrame) frame = requestAnimationFrame(render);
      else ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    };
    frame = requestAnimationFrame(render);

    return () => {
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer && typeof window !== "undefined") window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    };
  }, [cues]);

  return (
    <canvas
      ref={canvasRef}
      className="tow-combat__vfx-canvas"
      data-testid="tow-combat-vfx-canvas"
      data-renderer="canvas-2d"
      data-cue-count={cues.length}
      aria-hidden="true"
    />
  );
}
