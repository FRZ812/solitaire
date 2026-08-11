export const REFERENCE_GAMEPLAY_PREVIEW_ENV = "VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW";

export function referenceGameplayPreviewEnabled(environment = import.meta.env) {
  if (!environment || typeof environment !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(
      environment,
      REFERENCE_GAMEPLAY_PREVIEW_ENV,
    );
    return Boolean(descriptor && "value" in descriptor && descriptor.value === "true");
  } catch {
    return false;
  }
}

export const REFERENCE_GAMEPLAY_PREVIEW_ENABLED = referenceGameplayPreviewEnabled();
