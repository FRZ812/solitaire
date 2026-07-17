import React from "react";
import { InitialBackdrop } from "./InitialBackdrop.jsx";

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
}) {
  return (
    <main className="journey-loader" role="status" aria-live="polite" aria-busy="true">
      <InitialBackdrop />
      <div className="journey-loader__veil" aria-hidden="true" />
      <section className="journey-loader__content">
        <LoaderMark />
        <p>Solitaire</p>
        <h1>{title}</h1>
        <span>{detail}</span>
        <div className="journey-loader__track" aria-hidden="true"><i /></div>
      </section>
    </main>
  );
}

export function JourneyResumeOverlay() {
  return (
    <div className="journey-resume" role="status" aria-live="polite" aria-busy="true">
      <div className="journey-resume__card">
        <LoaderMark />
        <div>
          <strong>Restoring your journey</strong>
          <span>Checking for newer progress</span>
        </div>
        <div className="journey-loader__track" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
