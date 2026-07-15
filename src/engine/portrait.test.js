import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PORTRAIT_MAX_BYTES,
  normalizePortraitFile,
  portraitCropRect,
  portraitDataUrlBytes,
  portraitFileError,
} from "./portrait.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("portrait upload preparation", () => {
  it("accepts supported images and rejects unsafe input before decoding", () => {
    expect(portraitFileError({ type: "image/png", size: 1024 })).toBeNull();
    expect(portraitFileError({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(portraitFileError({ type: "image/webp", size: 1024 })).toBeNull();
    expect(portraitFileError({ type: "image/gif", size: 1024 })).toMatch(/PNG, JPEG, or WebP/);
    expect(portraitFileError({ type: "image/png", size: PORTRAIT_MAX_BYTES + 1 })).toMatch(/12 MB/);
    expect(portraitFileError({ type: "image/png", size: 0 })).toMatch(/empty/);
  });

  it("produces a centered, upward-biased 4:5 crop", () => {
    expect(portraitCropRect(2000, 1000)).toEqual({ sx: 600, sy: 0, sw: 800, sh: 1000 });
    const tall = portraitCropRect(1000, 2000);
    expect(tall.sx).toBe(0);
    expect(tall.sw).toBe(1000);
    expect(tall.sh).toBe(1250);
    expect(tall.sy).toBe(270);
  });

  it("rejects an excessive decoded pixel count before allocating a canvas", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 9000, height: 9000, close })));
    await expect(normalizePortraitFile({ type: "image/png", size: 1024 })).rejects.toThrow(/32 megapixels/);
    expect(close).toHaveBeenCalledOnce();
  });

  it("measures encoded payload bytes for save-size enforcement", () => {
    expect(portraitDataUrlBytes("data:image/webp;base64,QUJDRA==")).toBe(4);
    expect(portraitDataUrlBytes("not-a-data-url")).toBe(0);
  });
});
