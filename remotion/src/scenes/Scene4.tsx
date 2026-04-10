import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

const stats = [
  { value: "10K+", label: "Students" },
  { value: "50K+", label: "Documents" },
  { value: "98%", label: "Satisfaction" },
];

export const Scene4Stats = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 120 }}>
        {stats.map((stat, i) => {
          const delay = i * 12;
          const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
          const countOpacity = interpolate(frame, [delay + 5, delay + 20], [0, 1], { extrapolateRight: "clamp" });

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
                  fontSize: 96,
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
                  fontSize: 28,
                  color: "#888",
                  fontFamily: "sans-serif",
                  fontWeight: 500,
                  marginTop: 10,
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
