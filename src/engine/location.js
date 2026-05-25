export function coordKey(x, y) {
  return `${x},${y}`;
}

export function titleFromId(id) {
  if (!id || typeof id !== "string") return null;
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function poiFootprintName(poi) {
  return poi?.parentName || titleFromId(poi?.parent) || null;
}

export function poiPartName(poi) {
  return poi?.partName || poi?.vantageName || titleFromId(poi?.role);
}

export function poiPlaceName(poi) {
  if (!poi) return null;
  const footprint = poiFootprintName(poi);
  const part = poiPartName(poi);
  if (footprint && part) return `${footprint} - ${part}`;
  return poi.name || footprint || null;
}

export function poiMeta(tile, currentName = null) {
  const poi = tile?.poi;
  if (!poi) return { area: null, district: null, access: null, footprint: null, part: null };
  const footprint = poiFootprintName(poi);
  return {
    area: poi.areaName || titleFromId(poi.area),
    district: poi.districtName || titleFromId(poi.district),
    access: titleFromId(poi.access),
    footprint: footprint && footprint !== currentName ? footprint : null,
    part: poiPartName(poi),
  };
}
