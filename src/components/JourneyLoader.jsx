import React from "react";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { LoadingDots } from "./primitives.jsx";

function LoaderMark() {
  return (
    <div className="journey-loader__mark" aria-hidden="true">
      <span />
      <i />
    </div>
  );
}

export function JourneyLoader({
  title = "Returning to your journey",
  detail = "Restoring your latest save",
  onCancel = null,
}) {
  return (
    <main data-app-exclusive-surface className="journey-loader" role="status" aria-live="polite" aria-busy="true">
      <InitialBackdrop />
      <div className="journey-loader__veil" aria-hidden="true" />
      <section className="journey-loader__content">
        <LoaderMark />
        <p>Solitaire</p>
        <h1>{title}</h1>
        <span>{detail}</span>
        <div className="journey-loader__activity" aria-hidden="true"><LoadingDots /></div>
        {onCancel && (
          <button type="button" className="journey-loader__cancel" onClick={onCancel}>
            Back to journeys
          </button>
        )}
      </section>
    </main>
  );
}

export function JourneyResumeOverlay({
  onCancel = null,
  title = "Restoring your journey",
  detail = "Checking for newer progress",
}) {
  return (
    <div data-app-exclusive-surface className="journey-resume" role="status" aria-live="polite" aria-busy="true">
      <div className="journey-resume__card">
        <LoaderMark />
        <div>
          <strong>{title}</strong>
          <span>{detail}</span>
        </div>
        <div className="journey-loader__activity" aria-hidden="true"><LoadingDots /></div>
        {onCancel && (
          <button type="button" className="journey-loader__cancel" onClick={onCancel}>
            Back to journeys
          </button>
        )}
      </div>
    </div>
  );
}
