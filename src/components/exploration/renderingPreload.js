import mapAtlasUrl from "../../assets/generated/map-material-atlas.png";
import tradePoiAtlasUrl from "../../assets/generated/icon-atlases/trade-poi-atlas-v1.png";
import cityPoiAtlasUrl from "../../assets/generated/icon-atlases/city-poi-atlas-v1.png";
import wildernessPoiAtlasUrl from "../../assets/generated/icon-atlases/wilderness-poi-atlas-v1.png";
import { CONTINENT } from "../../data/continent.js";
import { atlas3dChunkForAxial } from "./worldAtlas3dModel.js";
import { preloadWorldAtlas3d } from "./worldAtlas3dRuntime.js";

const MAP_CANVAS_IMAGE_URLS = Object.freeze({
  material: mapAtlasUrl,
  trade: tradePoiAtlasUrl,
  city: cityPoiAtlasUrl,
  wilderness: wildernessPoiAtlasUrl,
});

const loadedImages = new Map();
const imagePromises = new Map();

function loadSharedImage(url) {
  const loaded = loadedImages.get(url);
  if (loaded) return Promise.resolve(loaded);
  const pending = imagePromises.get(url);
  if (pending) return pending;
  if (typeof Image === "undefined") return Promise.resolve(null);

  let imagePromise;
  imagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    // These supporting atlases should warm without competing with the title,
    // auth, or Three module requests on a constrained mobile connection.
    if ("fetchPriority" in image) image.fetchPriority = "low";
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      loadedImages.set(url, image);
      resolve(image);
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Could not preload rendering image: ${url}`));
    };
    image.src = url;
  });

  imagePromises.set(url, imagePromise);
  imagePromise.finally(() => {
    if (imagePromises.get(url) === imagePromise) imagePromises.delete(url);
  }).catch(() => {});
  return imagePromise;
}

function imageResult(images, id) {
  const result = images[id];
  return result?.status === "fulfilled" ? result.value : null;
}

export function getCachedMapCanvasImages() {
  return {
    material: loadedImages.get(MAP_CANVAS_IMAGE_URLS.material) || null,
    poi: {
      trade: loadedImages.get(MAP_CANVAS_IMAGE_URLS.trade) || null,
      city: loadedImages.get(MAP_CANVAS_IMAGE_URLS.city) || null,
      wilderness: loadedImages.get(MAP_CANVAS_IMAGE_URLS.wilderness) || null,
    },
  };
}

export async function preloadMapCanvasImages() {
  const entries = Object.entries(MAP_CANVAS_IMAGE_URLS);
  const settled = await Promise.all(entries.map(async ([id, url]) => [
    id,
    await Promise.allSettled([loadSharedImage(url)]).then(([result]) => result),
  ]));
  const images = Object.fromEntries(settled);
  return {
    material: imageResult(images, "material"),
    poi: {
      trade: imageResult(images, "trade"),
      city: imageResult(images, "city"),
      wilderness: imageResult(images, "wilderness"),
    },
  };
}

export function atlasStartChunkRequests(start = CONTINENT.start.coord) {
  const center = atlas3dChunkForAxial(start);
  const chunks = [];
  for (let cy = center.cy - 1; cy <= center.cy + 1; cy += 1) {
    for (let cx = center.cx - 1; cx <= center.cx + 1; cx += 1) {
      const dx = cx - center.cx;
      const dy = cy - center.cy;
      const distance = (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
      chunks.push({ cx, cy, lod: 0, distance });
    }
  }
  chunks.sort((a, b) => (
    a.distance - b.distance
    || a.cy - b.cy
    || a.cx - b.cx
  ));
  return chunks.map((chunk, index) => ({
    cx: chunk.cx,
    cy: chunk.cy,
    lod: 0,
    priority: (chunks.length - index) * 1000,
  }));
}

export function warmAtlasStartChunks(chunkClient, start = CONTINENT.start.coord) {
  if (!chunkClient?.request) {
    return Promise.reject(new TypeError("An atlas terrain chunk client is required."));
  }
  return Promise.all(atlasStartChunkRequests(start).map((chunk) => (
    chunkClient.request(chunk.cx, chunk.cy, chunk.lod, chunk.priority)
  )));
}

export function preloadGameRendering(seed = CONTINENT.seed) {
  // Initialize Three and the persistent worker first, then retain the 3x3 LOD0
  // neighborhood around the canonical party start in the client's warm cache.
  const atlas3d = preloadWorldAtlas3d(seed).then(async (atlas) => ({
    ...atlas,
    warmChunks: await warmAtlasStartChunks(atlas.chunkClient),
  }));
  const mapCanvas = preloadMapCanvasImages();
  return Promise.all([atlas3d, mapCanvas]).then(([atlas, mapImages]) => ({ atlas, mapImages }));
}
