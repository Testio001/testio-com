import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

export const Scene5CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const tagOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [20, 40], [30, 0], { extrapolateRight: "clamp" });

  // Pulsing glow
  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  // Logo subtle rotation
  const logoRotate = Math.sin(frame * 0.03) * 3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Big glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${TEAL}20, transparent 70%)`,
          filter: "blur(60px)",
          opacity: pulse,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* Logo */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            background: `linear-gradient(135deg, ${TEAL}, #1fa88a)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 50px",
            transform: `scale(${s}) rotate(${logoRotate}deg)`,
            boxShadow: `0 30px 80px ${TEAL}50`,
          }}
        >
          <span style={{ fontSize: 84, fontWeight: 800, color: "#0a0c14", fontFamily: "sans-serif" }}>T</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: "#fafafa",
            fontFamily: "sans-serif",
            letterSpacing: -3,
            transform: `scale(${s})`,
          }}
        >
          Start with <span style={{ color: TEAL }}>Testio</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            color: "#777",
            fontFamily: "sans-serif",
            fontWeight: 400,
            marginTop: 24,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
          }}
        >
          Study smarter. Not harder.
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 22,
            color: TEAL,
            fontFamily: "sans-serif",
            fontWeight: 600,
            marginTop: 40,
            opacity: tagOpacity,
            letterSpacing: 2,
          }}
        >
          testio-com.lovable.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
