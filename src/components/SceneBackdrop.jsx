import React from "react";

import { TERRAINS } from "../data/terrains.js";
import { getBiome } from "../data/biomes.js";
import { currentLocationName, getTile } from "../engine/world.js";

const TERRAIN_PALETTES = {
  indoor: {
    top: "#1a1714", mid: "#342d25", horizon: "#64513c",
    ground: "#171411", ground2: "#2d251e", accent: "#c9a66a",
  },
  settlement: {
    top: "#5f7f8c", mid: "#c7aa78", horizon: "#665748",
    ground: "#37362f", ground2: "#70634d", accent: "#d0b270",
  },
  road: {
    top: "#607985", mid: "#c8ad78", horizon: "#6d654f",
    ground: "#464238", ground2: "#8f805c", accent: "#d8bf7e",
  },
  plains: {
    top: "#668995", mid: "#cdb87c", horizon: "#7f8e60",
    ground: "#526d43", ground2: "#9aa36b", accent: "#d8c47c",
  },
  hills: {
    top: "#5f7a8b", mid: "#bfa172", horizon: "#806b50",
    ground: "#60694a", ground2: "#927b55", accent: "#d2b978",
  },
  forest: {
    top: "#344e55", mid: "#6f8065", horizon: "#263823",
    ground: "#19251a", ground2: "#405035", accent: "#b5a873",
  },
  marsh: {
    top: "#58747b", mid: "#969d72", horizon: "#526a59",
    ground: "#243d3b", ground2: "#637161", accent: "#c1b982",
  },
  mountains: {
    top: "#536878", mid: "#a98f75", horizon: "#514b45",
    ground: "#2b2926", ground2: "#696258", accent: "#cabca4",
  },
  water: {
    top: "#557d8d", mid: "#9ead86", horizon: "#385d69",
    ground: "#1d3944", ground2: "#527f87", accent: "#cdc282",
  },
};

function hashCoord(x, y) {
  let h = ((x | 0) * 374761393) ^ ((y | 0) * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function phaseForHour(hour) {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 8) return "dawn";
  if (hour >= 17 && hour < 21) return "dusk";
  return "day";
}

function paletteFor(terrain, phase) {
  const base = TERRAIN_PALETTES[terrain] || TERRAIN_PALETTES.plains;
  if (phase === "night") {
    return {
      ...base,
      top: "#111a20",
      mid: "#1d2a31",
      horizon: "#2d383d",
      ground: "#121716",
      ground2: "#25302b",
      accent: "#aebdcc",
    };
  }
  if (phase === "dawn") {
    return { ...base, top: "#556777", mid: "#c99d78", accent: "#dfbd83" };
  }
  if (phase === "dusk") {
    return { ...base, top: "#464057", mid: "#aa7660", accent: "#d7a36f" };
  }
  return base;
}

function Stars({ seed }) {
  const stars = Array.from({ length: 16 }, (_, i) => {
    const x = 24 + ((seed * 997 + i * 47) % 340);
    const y = 26 + ((seed * 613 + i * 31) % 220);
    const r = 0.7 + ((seed * 17 + i) % 4) * 0.18;
    return <circle key={i} cx={x} cy={y} r={r} fill="#eef6ff" opacity="0.72" />;
  });
  return <g>{stars}</g>;
}

function SkyDetail({ phase, seed }) {
  if (phase === "night") return <Stars seed={Math.round(seed * 1000)} />;
  return (
    <g opacity={phase === "day" ? 0.46 : 0.28}>
      <path d="M-20 142 C52 116 107 126 175 105 C234 88 307 108 420 73" fill="none" stroke="#fff4d2" strokeWidth="18" strokeLinecap="round" opacity="0.22" />
      <path d="M42 207 C96 193 146 203 205 184 C259 166 306 175 368 150" fill="none" stroke="#fff8df" strokeWidth="10" strokeLinecap="round" opacity="0.2" />
    </g>
  );
}

function SettlementShape({ palette, poiType }) {
  const tall = poiType === "fortress" || poiType === "city" || poiType === "palace";
  const ruin = poiType === "ruin" || poiType === "crypt";
  return (
    <g>
      <path d="M14 476 L58 438 L102 474 L151 421 L206 470 L252 438 L298 472 L352 430 L402 476 L402 625 L14 625 Z" fill={palette.ground2} opacity="0.7" />
      <rect x="57" y={tall ? 350 : 399} width="42" height={tall ? 130 : 82} rx="2" fill="#201c19" opacity="0.9" />
      <rect x="105" y="430" width="64" height="72" rx="2" fill="#2b251f" opacity="0.88" />
      <rect x="182" y={tall ? 365 : 415} width="58" height={tall ? 126 : 76} rx="2" fill="#241f1b" opacity="0.9" />
      <rect x="258" y="408" width="74" height="94" rx="2" fill="#2f271f" opacity="0.86" />
      <path d="M48 397 L78 363 L108 397 Z M172 413 L212 377 L252 413 Z M248 408 L295 369 L342 408 Z" fill={palette.accent} opacity="0.36" />
      {ruin && (
        <g opacity="0.85">
          <path d="M116 502 L116 428 L146 428 L146 502" fill="none" stroke="#171412" strokeWidth="12" />
          <path d="M116 428 C118 392 146 392 146 428" fill="none" stroke="#171412" strokeWidth="12" />
          <path d="M282 498 L315 430 L329 498" fill="none" stroke="#171412" strokeWidth="9" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function TerrainShapes({ terrain, poiType, palette, seed }) {
  const offset = Math.round(seed * 24) - 12;
  if (terrain === "mountains") {
    return (
      <g>
        <path d={`M-38 520 L68 294 L166 520 Z M74 526 L204 248 L334 526 Z M224 520 L343 321 L432 520 Z`} fill={palette.horizon} opacity="0.92" />
        <path d="M68 294 L103 405 L73 382 L42 449 Z M204 248 L242 381 L207 344 L166 447 Z M343 321 L365 405 L339 383 L309 452 Z" fill={palette.accent} opacity="0.42" />
        <path d="M-20 532 C84 498 133 514 211 489 C289 464 336 493 420 468 L420 844 L-20 844 Z" fill={palette.ground} />
      </g>
    );
  }
  if (terrain === "forest") {
    return (
      <g>
        <path d="M-10 432 C44 367 84 396 126 332 C172 398 217 357 264 320 C307 392 358 357 411 425 L411 844 L-10 844 Z" fill={palette.horizon} opacity="0.9" />
        {Array.from({ length: 11 }, (_, i) => {
          const x = -10 + i * 42 + (i % 2) * 10 + offset;
          const h = 124 + (i % 4) * 28;
          return (
            <g key={i} opacity="0.88">
              <rect x={x + 14} y={516 - h} width="12" height={h + 118} rx="5" fill="#121a13" />
              <path d={`M${x - 12} ${462 - h * 0.45} L${x + 20} ${348 - h * 0.38} L${x + 54} ${462 - h * 0.45} Z`} fill="#1d321f" />
              <path d={`M${x - 4} ${410 - h * 0.45} L${x + 20} ${324 - h * 0.4} L${x + 45} ${410 - h * 0.45} Z`} fill="#284226" />
            </g>
          );
        })}
      </g>
    );
  }
  if (terrain === "marsh") {
    return (
      <g>
        <path d="M-20 478 C53 446 101 477 162 452 C229 425 285 461 410 428 L410 844 L-20 844 Z" fill={palette.ground2} opacity="0.9" />
        <path d="M-20 568 C74 547 143 575 219 550 C289 528 345 547 410 522 L410 844 L-20 844 Z" fill={palette.ground} />
        <path d="M-20 604 C58 584 120 610 194 592 C284 569 336 592 410 568 L410 688 C316 710 266 678 193 699 C111 722 48 690 -20 713 Z" fill="#234b55" opacity="0.72" />
        {Array.from({ length: 24 }, (_, i) => {
          const x = (i * 18 + offset + 390) % 410;
          const y = 505 + (i % 6) * 27;
          return <path key={i} d={`M${x} ${y + 54} C${x - 4} ${y + 22} ${x + 2} ${y + 8} ${x + 6} ${y}`} fill="none" stroke="#162b21" strokeWidth="3" strokeLinecap="round" opacity="0.76" />;
        })}
      </g>
    );
  }
  if (terrain === "water") {
    return (
      <g>
        <path d="M-20 450 C74 423 125 454 205 425 C280 399 343 429 410 404 L410 520 C323 549 267 514 199 538 C119 567 57 526 -20 560 Z" fill={palette.horizon} opacity="0.75" />
        <rect x="-20" y="505" width="430" height="339" fill={palette.ground} />
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={`M${-24 + (i % 2) * 21} ${548 + i * 24} C64 ${527 + i * 24} 126 ${569 + i * 24} 206 ${543 + i * 24} C278 ${520 + i * 24} 337 ${552 + i * 24} 420 ${528 + i * 24}`} fill="none" stroke={i % 2 ? "#6eb2bd" : palette.accent} strokeWidth={i % 2 ? 2 : 1.3} opacity={i % 2 ? 0.23 : 0.2} />
        ))}
      </g>
    );
  }
  if (terrain === "settlement" || terrain === "road" || terrain === "indoor") {
    return (
      <g>
        <SettlementShape palette={palette} poiType={poiType} />
        <path d="M-10 609 C75 582 126 614 202 592 C281 570 341 590 410 560 L410 844 L-10 844 Z" fill={terrain === "indoor" ? "#0d0a08" : palette.ground} opacity="0.96" />
        {terrain === "road" && <path d="M160 844 C174 764 178 686 190 604 C203 685 222 762 246 844 Z" fill={palette.ground2} opacity="0.9" />}
        {terrain === "indoor" && (
          <g opacity="0.42">
            <path d="M-20 486 L410 486" stroke={palette.accent} strokeWidth="2" />
            <path d="M70 844 L159 486 M316 844 L236 486" stroke={palette.accent} strokeWidth="2" />
          </g>
        )}
      </g>
    );
  }
  return (
    <g>
      <path d={`M-20 486 C47 ${448 + offset} 105 500 175 462 C238 429 302 475 410 432 L410 844 L-20 844 Z`} fill={terrain === "hills" ? palette.horizon : palette.ground2} opacity="0.9" />
      <path d={`M-20 578 C82 ${535 - offset} 147 590 230 552 C301 520 349 544 410 520 L410 844 L-20 844 Z`} fill={palette.ground} />
      <path d="M-20 666 C62 641 142 684 220 652 C294 621 356 649 410 626 L410 844 L-20 844 Z" fill={palette.ground2} opacity="0.58" />
      {terrain === "hills" && (
        <path d="M-20 538 C62 486 113 519 174 470 C228 532 286 482 410 450" fill="none" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" opacity="0.18" />
      )}
    </g>
  );
}

function ForegroundTexture({ terrain }) {
  if (terrain === "indoor") return null;
  return (
    <g opacity="0.22">
      <path d="M20 752 C46 730 64 779 88 744 M132 772 C158 738 176 798 205 752 M260 760 C282 728 314 792 348 746" fill="none" stroke="#f5e7b8" strokeWidth="2" strokeLinecap="round" />
      {terrain !== "water" && (
        <path d="M38 820 C70 792 99 836 132 804 M197 824 C230 796 254 838 300 800" fill="none" stroke="#070909" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
      )}
    </g>
  );
}

export function SceneBackdrop({ state }) {
  const cur = state.world.currentTile;
  const tile = getTile(state, cur.x, cur.y);
  const terrain = tile.terrain || "plains";
  const phase = phaseForHour(state.time.hour);
  const palette = paletteFor(terrain, phase);
  const seed = hashCoord(cur.x, cur.y);
  const biome = getBiome(cur.x, cur.y);
  const poiType = tile.poi?.type || null;
  const location = currentLocationName(state);
  const terrainLabel = TERRAINS[terrain]?.label || terrain;

  return (
    <div
      aria-label={`${location}, ${terrainLabel}, ${biome.name}`}
      style={{ position: "absolute", inset: 0, overflow: "hidden", backgroundColor: palette.ground }}
    >
      <svg viewBox="0 0 390 844" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="sceneSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="48%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.horizon} />
          </linearGradient>
          <linearGradient id="sceneVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.14" />
            <stop offset="42%" stopColor="#000000" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.66" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="390" height="844" fill="url(#sceneSky)" />
        <SkyDetail phase={phase} seed={seed} />
        <TerrainShapes terrain={terrain} poiType={poiType} palette={palette} seed={seed} />
        {poiType === "hidden" && (
          <g opacity="0.5">
            <path d="M-20 428 C72 404 128 436 205 410 C286 382 344 410 420 386" fill="none" stroke="#f2e8d0" strokeWidth="30" strokeLinecap="round" opacity="0.18" />
            <path d="M-20 510 C80 486 155 530 230 500 C302 472 350 502 420 470" fill="none" stroke="#f2e8d0" strokeWidth="18" strokeLinecap="round" opacity="0.2" />
          </g>
        )}
        <ForegroundTexture terrain={terrain} />
        <rect x="0" y="0" width="390" height="844" fill="#d8c8a8" opacity="0.06" />
        <rect x="0" y="0" width="390" height="844" fill="url(#sceneVignette)" />
      </svg>
    </div>
  );
}
