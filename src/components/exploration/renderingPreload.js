import mapAtlasUrl from "../../assets/generated/map-material-atlas.png";
import tradePoiAtlasUrl from "../../assets/generated/icon-atlases/trade-poi-atlas-v1.png";
import cityPoiAtlasUrl from "../../assets/generated/icon-atlases/city-poi-atlas-v1.png";
import wildernessPoiAtlasUrl from "../../assets/generated/icon-atlases/wilderness-poi-atlas-v1.png";
import { CONTINENT } from "../../data/continent.js";
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

export function preloadGameRendering(seed = CONTINENT.seed) {
  const atlas3d = preloadWorldAtlas3d(seed);
  const mapCanvas = preloadMapCanvasImages();
  return Promise.all([atlas3d, mapCanvas]).then(([atlas, mapImages]) => ({ atlas, mapImages }));
}
