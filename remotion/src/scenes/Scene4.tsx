import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

const stats = [
  { value: "10K+", label: "Active Students" },
  { value: "50K+", label: "Documents Processed" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "4.9★", label: "Average Rating" },
];

export const Scene4Stats = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: "#fafafa",
          fontFamily: "sans-serif",
          letterSpacing: -2,
          marginBottom: 80,
          opacity: headingOpacity,
          textAlign: "center",
        }}
      >
        Trusted by <span style={{ color: TEAL }}>thousands</span>
      </div>

      <div style={{ display: "flex", gap: 100 }}>
        {stats.map((stat, i) => {
          const delay = 10 + i * 14;
          const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
          const countOpacity = interpolate(frame, [delay + 5, delay + 22], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={stat.label}
              style={{
                textAlign: "center",
                transform: `scale(${s})`,
              }}
            >
              <div
                style={{
                  fontSize: 88,
                  fontWeight: 800,
                  color: TEAL,
                  fontFamily: "sans-serif",
                  letterSpacing: -3,
                  opacity: countOpacity,
                  textShadow: `0 0 40px ${TEAL}40`,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: "#888",
                  fontFamily: "sans-serif",
                  fontWeight: 500,
                  marginTop: 12,
                  opacity: countOpacity,
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
