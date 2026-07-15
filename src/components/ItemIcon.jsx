import React from "react";
import equipmentAtlas from "../assets/generated/icon-atlases/equipment-types-atlas-v1.png";
import itemAtlas from "../assets/generated/icon-atlases/item-types-atlas-v1.png";
import { AtlasIcon } from "./AtlasIcon.jsx";
import { itemIconTaxonomy } from "./item-icon-taxonomy.js";

const ATLASES = Object.freeze({
  equipment: equipmentAtlas,
  items: itemAtlas,
});

export function ItemIcon({
  item,
  itemId,
  size = 14,
  className = "",
  decorative = true,
  style,
}) {
  const taxonomy = itemIconTaxonomy(item, itemId);
  return (
    <AtlasIcon
      src={ATLASES[taxonomy.atlas]}
      columns={taxonomy.columns}
      rows={taxonomy.rows}
      column={taxonomy.column}
      row={taxonomy.row}
      size={size}
      label={`${taxonomy.label} icon`}
      iconKey={`${taxonomy.atlas}:${taxonomy.key}`}
      decorative={decorative}
      className={`item-atlas-icon${className ? ` ${className}` : ""}`}
      shape="square"
      style={style}
    />
  );
}
