import React from "react";

// Top-level resilience net. The narrator returns free-form JSON that flows into
// game state and then into render, so a single malformed beat — or an unexpected
// saved-state shape — can throw mid-render and white-screen the entire app with
// no way back. This boundary catches any render/lifecycle throw beneath it and
// shows a styled, recoverable fallback (reload) instead. Styling mirrors the
// map-load fallback in main.jsx so it reads as part of the app, not a crash.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Friendly fallback for the player; full detail to the console for debugging.
    console.error(`Unhandled error in ${this.props.label || "the app"}:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "24px", color: "#f5dcb8", fontFamily: "'Inter', sans-serif",
          backgroundColor: "#0c1111", minHeight: "100vh",
        }}>
          <h2 style={{ color: "#e58a7a" }}>Something went wrong</h2>
          <p style={{ marginTop: "8px", lineHeight: 1.5 }}>
            The {this.props.label || "app"} hit an unexpected error. Your progress is
            saved to your campaign — reloading should pick it back up.
          </p>
          <pre style={{
            marginTop: "8px", whiteSpace: "pre-wrap", opacity: 0.6, fontSize: "12px",
          }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "12px", padding: "6px 14px", cursor: "pointer" }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
