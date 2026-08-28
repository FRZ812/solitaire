import { canonicalJsonData } from "./json-data.js";

export const CHECKSUM_ALGORITHM = "fnv1a64-utf16-v1";

/** Stable non-cryptographic checksum used by current deterministic receipts. */
export function gameplayChecksum(value) {
  const json = canonicalJsonData(value);
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let index = 0; index < json.length; index += 1) {
    low = (low ^ json.charCodeAt(index)) >>> 0;
    const lowProduct = low * 0x1b3;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    high = (high * 0x1b3 + low * 0x100 + carry) >>> 0;
    low = lowProduct >>> 0;
  }
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}
