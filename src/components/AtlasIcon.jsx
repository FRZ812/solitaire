import React from "react";
import "./atlas-icon.css";

const SHAPES = new Set(["square", "round", "portrait"]);

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function cellIndex(value, count) {
  const number = Number(value);
  const index = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(count - 1, index));
}

// CSS background-position percentages describe the remaining travel distance,
// not a percentage of the image itself. For an evenly divided sprite sheet,
// index / (cellCount - 1) therefore aligns the first and last cells exactly.
export function atlasBackgroundPosition(index, cellCount) {
  const count = positiveInteger(cellCount);
  if (count === 1) return "0%";
  const resolvedIndex = cellIndex(index, count);
  return `${(resolvedIndex / (count - 1)) * 100}%`;
}

function cssSize(size) {
  if (typeof size === "number" && Number.isFinite(size)) return `${Math.max(0, size)}px`;
  return typeof size === "string" && size.trim() ? size : "32px";
}

function cssImage(src) {
  return src ? `url(${JSON.stringify(String(src))})` : "none";
}

export function AtlasIcon({
  src,
  columns = 1,
  rows = 1,
  column = 0,
  row = 0,
  size = 32,
  label,
  iconKey,
  decorative = false,
  className = "",
  shape = "square",
  style,
}) {
  const resolvedColumns = positiveInteger(columns);
  const resolvedRows = positiveInteger(rows);
  const resolvedColumn = cellIndex(column, resolvedColumns);
  const resolvedRow = cellIndex(row, resolvedRows);
  const resolvedShape = SHAPES.has(shape) ? shape : "square";
  const accessibleLabel = label || "Atlas icon";

  return (
    <span
      className={`atlas-icon atlas-icon--${resolvedShape}${className ? ` ${className}` : ""}`}
      style={{
        "--atlas-image": cssImage(src),
        "--atlas-columns": resolvedColumns,
        "--atlas-rows": resolvedRows,
        "--atlas-background-width": `${resolvedColumns * 100}%`,
        "--atlas-background-height": `${resolvedRows * 100}%`,
        "--atlas-column-position": atlasBackgroundPosition(resolvedColumn, resolvedColumns),
        "--atlas-row-position": atlasBackgroundPosition(resolvedRow, resolvedRows),
        "--atlas-size": cssSize(size),
        ...style,
      }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleLabel}
      aria-hidden={decorative ? "true" : undefined}
      data-atlas-column={resolvedColumn}
      data-atlas-row={resolvedRow}
      data-icon-key={iconKey}
    >
      <span className="atlas-icon__sprite" aria-hidden="true" />
    </span>
  );
}
