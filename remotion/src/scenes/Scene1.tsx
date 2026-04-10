import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [20, 45], [60, 0], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [45, 70], [40, 0], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [55, 90], [0, 400], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: "clamp" });

  const circleScale = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 80, mass: 2 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          border: `2px solid ${TEAL}20`,
          transform: `scale(${circleScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: `1px solid ${TEAL}15`,
          transform: `scale(${circleScale}) rotate(${frame * 0.4}deg)`,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
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
            transform: `scale(${logoScale})`,
            boxShadow: `0 20px 60px ${TEAL}40`,
          }}
        >
          <span style={{ fontSize: 84, fontWeight: 800, color: "#0a0c14", fontFamily: "sans-serif" }}>T</span>
        </div>

        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: "#fafafa",
            fontFamily: "sans-serif",
            letterSpacing: -4,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          Meet <span style={{ color: TEAL }}>Testio</span>
        </div>

        <div
          style={{
            width: lineWidth,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
            margin: "24px auto",
          }}
        />

        <div
          style={{
            fontSize: 36,
            color: "#999",
            fontFamily: "sans-serif",
            fontWeight: 400,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          Your AI-powered study companion
        </div>

        <div
          style={{
            fontSize: 24,
            color: TEAL,
            fontFamily: "sans-serif",
            fontWeight: 600,
            marginTop: 30,
            opacity: urlOpacity,
            letterSpacing: 3,
          }}
        >
          Testio.online
        </div>
      </div>
    </AbsoluteFill>
  );
};
