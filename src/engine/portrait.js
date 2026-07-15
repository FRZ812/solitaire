export const PORTRAIT_ACCEPT = "image/png,image/jpeg,image/webp";
export const PORTRAIT_MAX_BYTES = 12 * 1024 * 1024;
export const PORTRAIT_MAX_PIXELS = 32 * 1024 * 1024;
export const PORTRAIT_MAX_OUTPUT_BYTES = 900 * 1024;
export const PORTRAIT_ASPECT = 4 / 5;

const ACCEPTED_TYPES = new Set(PORTRAIT_ACCEPT.split(","));

export function portraitFileError(file) {
  if (!file) return "Choose an image first.";
  if (!ACCEPTED_TYPES.has(file.type)) return "Use a PNG, JPEG, or WebP image.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "That image is empty.";
  if (file.size > PORTRAIT_MAX_BYTES) return "Portraits must be 12 MB or smaller.";
  return null;
}

// Center-crop to 4:5 while biasing a tall source slightly upward so faces from
// ordinary phone portraits are less likely to be clipped.
export function portraitCropRect(width, height) {
  const sourceAspect = width / height;
  if (sourceAspect > PORTRAIT_ASPECT) {
    const cropWidth = height * PORTRAIT_ASPECT;
    return { sx: (width - cropWidth) / 2, sy: 0, sw: cropWidth, sh: height };
  }
  const cropHeight = width / PORTRAIT_ASPECT;
  return { sx: 0, sy: Math.max(0, (height - cropHeight) * 0.36), sw: width, sh: cropHeight };
}

function imageFromObjectUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The selected image could not be decoded.")); };
    image.src = url;
  });
}

export function portraitDataUrlBytes(value) {
  const payload = String(value || "").split(",", 2)[1] || "";
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.ceil((payload.length * 3) / 4) - padding);
}

export async function normalizePortraitFile(file, { width = 768, quality = 0.84 } = {}) {
  const invalid = portraitFileError(file);
  if (invalid) throw new Error(invalid);

  let source;
  let close = null;
  if (typeof createImageBitmap === "function") {
    try {
      source = await createImageBitmap(file);
      close = () => source.close?.();
    } catch {
      source = await imageFromObjectUrl(file);
    }
  } else {
    source = await imageFromObjectUrl(file);
  }

  try {
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("The selected image has invalid dimensions.");
    if (sourceWidth * sourceHeight > PORTRAIT_MAX_PIXELS) {
      throw new Error("That image is too large to prepare safely. Use an image under 32 megapixels.");
    }
    const crop = portraitCropRect(sourceWidth, sourceHeight);
    const targetWidth = Math.max(320, Math.min(width, Math.round(crop.sw)));
    const targetHeight = Math.round(targetWidth / PORTRAIT_ASPECT);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot prepare the portrait.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) throw new Error("This browser could not encode a compact WebP portrait.");
    if (portraitDataUrlBytes(dataUrl) > PORTRAIT_MAX_OUTPUT_BYTES) {
      throw new Error("The prepared portrait is still too large to store in this campaign.");
    }
    return dataUrl;
  } finally {
    close?.();
  }
}
