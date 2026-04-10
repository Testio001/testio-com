import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [15, 35], [60, 0], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [30, 50], [40, 0], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [40, 70], [0, 300], { extrapolateRight: "clamp" });

  // Teal circle accent
  const circleScale = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 80, mass: 2 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Large decorative circle */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: `2px solid ${TEAL}20`,
          transform: `scale(${circleScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 350,
          height: 350,
          borderRadius: "50%",
          border: `1px solid ${TEAL}15`,
          transform: `scale(${circleScale}) rotate(${frame * 0.5}deg)`,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* Logo T */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            background: `linear-gradient(135deg, ${TEAL}, #1fa88a)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 40px",
            transform: `scale(${logoScale})`,
            boxShadow: `0 20px 60px ${TEAL}40`,
          }}
        >
          <span style={{ fontSize: 72, fontWeight: 800, color: "#0a0c14", fontFamily: "sans-serif" }}>T</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: "#fafafa",
            fontFamily: "sans-serif",
            letterSpacing: -3,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          Meet <span style={{ color: TEAL }}>Testio</span>
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
            margin: "20px auto",
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#888",
            fontFamily: "sans-serif",
            fontWeight: 400,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          Your AI-powered study companion
        </div>
      </div>
    </AbsoluteFill>
  );
};
