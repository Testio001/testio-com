import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

export const Scene5CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const tagOpacity = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(frame, [25, 50], [30, 0], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const urlScale = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 100 } });

  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;
  const logoRotate = Math.sin(frame * 0.03) * 3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${TEAL}20, transparent 70%)`,
          filter: "blur(60px)",
          opacity: pulse,
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 36,
            background: `linear-gradient(135deg, ${TEAL}, #1fa88a)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 50px",
            transform: `scale(${s}) rotate(${logoRotate}deg)`,
            boxShadow: `0 30px 80px ${TEAL}50`,
          }}
        >
          <span style={{ fontSize: 96, fontWeight: 800, color: "#0a0c14", fontFamily: "sans-serif" }}>T</span>
        </div>

        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#fafafa",
            fontFamily: "sans-serif",
            letterSpacing: -3,
            transform: `scale(${s})`,
          }}
        >
          Start with <span style={{ color: TEAL }}>Testio</span>
        </div>

        <div
          style={{
            fontSize: 34,
            color: "#777",
            fontFamily: "sans-serif",
            fontWeight: 400,
            marginTop: 28,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
          }}
        >
          Study smarter. Not harder.
        </div>

        <div
          style={{
            fontSize: 32,
            color: TEAL,
            fontFamily: "sans-serif",
            fontWeight: 700,
            marginTop: 50,
            opacity: urlOpacity,
            transform: `scale(${urlScale})`,
            letterSpacing: 4,
            textShadow: `0 0 30px ${TEAL}40`,
          }}
        >
          Testio.online
        </div>

        <div
          style={{
            fontSize: 18,
            color: "#555",
            fontFamily: "sans-serif",
            fontWeight: 400,
            marginTop: 20,
            opacity: urlOpacity,
          }}
        >
          Created by TechWorld
        </div>
      </div>
    </AbsoluteFill>
  );
};
