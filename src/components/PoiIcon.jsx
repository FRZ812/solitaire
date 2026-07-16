import React from "react";
import tradePoiAtlas from "../assets/generated/icon-atlases/trade-poi-atlas-v1.png";
import cityPoiAtlas from "../assets/generated/icon-atlases/city-poi-atlas-v1.png";
import wildernessPoiAtlas from "../assets/generated/icon-atlases/wilderness-poi-atlas-v1.png";
import {
  POI_ATLAS_CELL,
  POI_ATLAS_SIZE,
  poiIconMeta,
} from "../data/poi-icons.js";
import { marketPriceTierVisual } from "../data/town.js";

const ATLAS_URLS = Object.freeze({
  trade: tradePoiAtlas,
  city: cityPoiAtlas,
  wilderness: wildernessPoiAtlas,
});

export function PoiIcon({ iconKey, size = 28, title = null, marketTier = null, className = "", style = {} }) {
  const icon = poiIconMeta(iconKey);
  if (!icon) return null;
  const tier = marketPriceTierVisual(marketTier);
  const originX = icon.col * POI_ATLAS_CELL;
  const originY = icon.row * POI_ATLAS_CELL;
  const viewBox = `${icon.col * POI_ATLAS_CELL} ${icon.row * POI_ATLAS_CELL} ${POI_ATLAS_CELL} ${POI_ATLAS_CELL}`;
  const frameInset = POI_ATLAS_CELL * 0.045;
  const badgeRadius = POI_ATLAS_CELL * 0.115;
  const badgeX = originX + POI_ATLAS_CELL * 0.79;
  const badgeY = originY + POI_ATLAS_CELL * 0.79;
  const accessibleTitle = title && tier ? `${title} · ${tier.label}` : title;
  const filter = tier
    ? `drop-shadow(0 2px 4px rgba(0,0,0,0.72)) drop-shadow(0 0 5px ${tier.color})`
    : "drop-shadow(0 2px 4px rgba(0,0,0,0.72))";

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      overflow="hidden"
      className={`poi-icon${tier ? " has-market-tier" : ""}${className ? ` ${className}` : ""}`}
      role={accessibleTitle ? "img" : undefined}
      aria-label={accessibleTitle || undefined}
      aria-hidden={accessibleTitle ? undefined : true}
      data-poi-icon={iconKey}
      data-poi-tier={tier?.id || undefined}
      style={{ display: "block", filter, ...style }}
    >
      {accessibleTitle && <title>{accessibleTitle}</title>}
      <image href={ATLAS_URLS[icon.atlas]} width={POI_ATLAS_SIZE} height={POI_ATLAS_SIZE} />
      {tier && (
        <>
          <rect
            x={originX + frameInset}
            y={originY + frameInset}
            width={POI_ATLAS_CELL - frameInset * 2}
            height={POI_ATLAS_CELL - frameInset * 2}
            rx={POI_ATLAS_CELL * 0.46}
            fill="none"
            stroke={tier.color}
            strokeWidth={POI_ATLAS_CELL * 0.035}
          />
          <circle cx={badgeX} cy={badgeY} r={badgeRadius} fill="rgba(7, 13, 16, 0.96)" stroke={tier.color} strokeWidth={POI_ATLAS_CELL * 0.025} />
          <text
            x={badgeX}
            y={badgeY}
            fill={tier.color}
            stroke="rgba(7, 13, 16, 0.92)"
            strokeWidth={POI_ATLAS_CELL * 0.01}
            paintOrder="stroke"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="system-ui, sans-serif"
            fontWeight="900"
            fontSize={POI_ATLAS_CELL * 0.14}
          >
            {tier.marker}
          </text>
        </>
      )}
    </svg>
  );
}

export function PoiTierMarker({ marketTier, size = 18, showLabel = false, className = "" }) {
  const tier = marketPriceTierVisual(marketTier);
  if (!tier) return null;
  return (
    <span
      className={className || undefined}
      role="img"
      aria-label={`${tier.label} POI tier`}
      title={`${tier.label} · ${tier.summary}`}
      data-poi-tier-marker={tier.id}
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: tier.color, whiteSpace: "nowrap" }}
    >
      <b
        aria-hidden="true"
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          border: `2px solid ${tier.color}`,
          background: "radial-gradient(circle, rgba(31,45,45,.96), rgba(7,13,16,.98))",
          boxShadow: `0 0 0 1px rgba(9,13,14,.78), 0 0 7px color-mix(in srgb, ${tier.color} 42%, transparent)`,
          color: tier.color,
          fontSize: `${Math.max(8, Math.round(size * 0.52))}px`,
          fontFamily: "system-ui, sans-serif",
          fontStyle: "normal",
          lineHeight: 1,
        }}
      >
        {tier.marker}
      </b>
      {showLabel && <span aria-hidden="true">{tier.label.replace(/ house$/, "")}</span>}
    </span>
  );
}

// Backward-compatible name for callers that only render the trade subset.
export const TradePoiIcon = PoiIcon;

export {
  CITY_POI_ICONS,
  isPoiIcon,
  isTradePoiIcon,
  POI_ICONS,
  POI_LEGEND_GROUPS,
  POI_LEGEND_ITEMS,
  poiIconKeyForLandmark,
  poiIconKeyForTile,
  poiIconMeta,
  TRADE_POI_ICONS,
  TRADE_POI_LEGEND_ITEMS,
  WILDERNESS_POI_ICONS,
} from "../data/poi-icons.js";
