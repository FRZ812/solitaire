import React from "react";

export function InitialBackdrop() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "#080c0c",
      backgroundImage: "radial-gradient(circle at 50% 30%, #111b19 0%, #050808 90%)",
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none",
    }}>
      <style>{`
        @keyframes bgTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.95; transform: scale(1.1); }
        }
        @keyframes bgAstrolabeSpin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes bgAstrolabeRevSpin {
          0% { transform: translate(-50%, -50%) rotate(360deg); }
          100% { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes bgFloatUp {
          0% { transform: translateY(110%) translateX(0); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-10%) translateX(20px); opacity: 0; }
        }
      `}</style>

      {/* Twinkling Starfield */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {[
          { cx: "10%", cy: "15%", d: "2.5s", r: 1.2 },
          { cx: "25%", cy: "8%", d: "4.1s", r: 0.9 },
          { cx: "42%", cy: "22%", d: "3.2s", r: 1.5 },
          { cx: "65%", cy: "12%", d: "5.3s", r: 0.8 },
          { cx: "88%", cy: "18%", d: "2.8s", r: 1.1 },
          { cx: "15%", cy: "38%", d: "3.7s", r: 1.3 },
          { cx: "82%", cy: "42%", d: "4.5s", r: 1.0 },
          { cx: "55%", cy: "48%", d: "5.8s", r: 0.7 },
          { cx: "30%", cy: "55%", d: "3.1s", r: 1.4 },
          { cx: "70%", cy: "62%", d: "2.2s", r: 1.2 },
        ].map((s, idx) => (
          <circle
            key={idx}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#ede4d0"
            style={{
              animation: `bgTwinkle ${s.d} ease-in-out infinite`,
              transformOrigin: `${s.cx} ${s.cy}`,
            }}
          />
        ))}
      </svg>

      {/* Huge Rotating Celestial Astrolabe (Mid-Screen Background) */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        width: "560px",
        height: "560px",
        opacity: 0.08,
        transformOrigin: "center",
      }}>
        {/* Outer Clockwise Astrolabe */}
        <svg
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            transform: "translate(-50%, -50%)",
            animation: "bgAstrolabeSpin 180s linear infinite",
            transformOrigin: "center",
          }}
        >
          {/* Ring borders */}
          <circle cx="100" cy="100" r="95" fill="none" stroke="#d7a76f" strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="#d7a76f" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="#d7a76f" strokeWidth="1.2" strokeDasharray="40 10 20 10" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#d7a76f" strokeWidth="0.6" />

          {/* Star Lines & Geometries */}
          <line x1="100" y1="5" x2="100" y2="195" stroke="#d7a76f" strokeWidth="0.4" />
          <line x1="5" y1="100" x2="195" y2="100" stroke="#d7a76f" strokeWidth="0.4" />
          <line x1="32.8" y1="32.8" x2="167.2" y2="167.2" stroke="#d7a76f" strokeWidth="0.4" />
          <line x1="32.8" y1="167.2" x2="167.2" y2="32.8" stroke="#d7a76f" strokeWidth="0.4" />

          {/* Hexagram motif */}
          <polygon points="100,18 171,141 29,141" fill="none" stroke="#d7a76f" strokeWidth="0.5" opacity="0.6" />
          <polygon points="100,182 29,59 171,59" fill="none" stroke="#d7a76f" strokeWidth="0.5" opacity="0.6" />

          {/* Center concentric accent */}
          <circle cx="100" cy="100" r="30" fill="none" stroke="#d7a76f" strokeWidth="0.8" />
          <circle cx="100" cy="100" r="28" fill="none" stroke="#d7a76f" strokeWidth="0.4" strokeDasharray="2 2" />
        </svg>

        {/* Inner Counter-Clockwise Runic Ring */}
        <svg
          viewBox="0 0 200 200"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            transform: "translate(-50%, -50%)",
            animation: "bgAstrolabeRevSpin 90s linear infinite",
            transformOrigin: "center",
          }}
        >
          {/* Inner ring */}
          <circle cx="100" cy="100" r="55" fill="none" stroke="#d7a76f" strokeWidth="1" strokeDasharray="12 4" />
          <circle cx="100" cy="100" r="48" fill="none" stroke="#d7a76f" strokeWidth="0.5" />
          
          {/* Subtle runic marks on inner ring */}
          <g stroke="#d7a76f" strokeWidth="0.8" fill="none" opacity="0.85">
            {/* Runes represented by geometric symbols */}
            <path d="M96 40 H104 M100 37 V43" />
            <path d="M141 59 L147 65 M147 59 L141 65" />
            <path d="M157 96 V104 M160 100 H154" />
            <path d="M141 141 L147 147" />
            <path d="M100 155 V163" />
            <path d="M59 141 L65 147 M65 141 L59 147" />
            <path d="M37 100 H45" />
            <path d="M59 59 L65 65" />
          </g>
        </svg>
      </div>

      {/* Magical Rising Fireflies / Embers */}
      {[
        { left: "15%", size: "4px", delay: "0s", duration: "11s" },
        { left: "30%", size: "3px", delay: "2.5s", duration: "9s" },
        { left: "45%", size: "5px", delay: "1.2s", duration: "13s" },
        { left: "60%", size: "4px", delay: "4s", duration: "10s" },
        { left: "75%", size: "3px", delay: "0.5s", duration: "12s" },
        { left: "88%", size: "5px", delay: "3.2s", duration: "15s" },
        { left: "10%", size: "3px", delay: "5.5s", duration: "11s" },
        { left: "52%", size: "4px", delay: "7.1s", duration: "9.5s" },
      ].map((f, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            bottom: "0",
            left: f.left,
            width: f.size,
            height: f.size,
            borderRadius: "50%",
            backgroundColor: "#d7a76f",
            filter: "drop-shadow(0 0 5px #d7a76f)",
            animation: `bgFloatUp ${f.duration} linear infinite`,
            animationDelay: f.delay,
            opacity: 0,
          }}
        />
      ))}

      {/* Layered Misty Mountain Silhouettes (at the bottom) */}
      <svg
        viewBox="0 0 480 200"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          bottom: "-5px",
          left: "0",
          width: "100%",
          height: "140px",
          opacity: 0.38,
        }}
      >
        {/* Distant mountain layer */}
        <path
          d="M0 200 L0 120 L80 85 L140 108 L220 65 L290 98 L360 52 L430 88 L480 62 L480 200 Z"
          fill="#060c0a"
          opacity="0.5"
        />
        {/* Mid-distance mountain layer */}
        <path
          d="M0 200 L0 150 L60 125 L120 138 L190 102 L260 128 L320 90 L390 122 L450 96 L480 112 L480 200 Z"
          fill="#030807"
          opacity="0.75"
        />
        {/* Close mountain layer */}
        <path
          d="M0 200 L0 175 L80 155 L160 162 L230 138 L300 158 L370 128 L440 152 L480 132 L480 200 Z"
          fill="#010403"
        />
      </svg>

      {/* Vignette Overlay for rich contrast */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at center, transparent 30%, rgba(5,8,8,0.72) 100%)",
      }} />
    </div>
  );
}
