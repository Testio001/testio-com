import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const TEAL = "#26c6a0";

const features = [
  { icon: "📝", label: "Smart Notes" },
  { icon: "🃏", label: "Flashcards" },
  { icon: "❓", label: "Quizzes" },
  { icon: "🎧", label: "Podcasts" },
];

export const Scene2Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headingY = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 100 }}>
      {/* Heading */}
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: "#fafafa",
          fontFamily: "sans-serif",
          letterSpacing: -2,
          marginBottom: 80,
          opacity: headingOpacity,
          transform: `translateY(${headingY}px)`,
          textAlign: "center",
        }}
      >
        Turn anything into{" "}
        <span style={{ color: TEAL }}>study tools</span>
      </div>

      {/* Feature cards */}
      <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
        {features.map((feat, i) => {
          const delay = 15 + i * 10;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
          const cardOpacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={feat.label}
              style={{
                width: 280,
                height: 220,
                borderRadius: 24,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                transform: `scale(${s}) translateY(${(1 - s) * 30}px)`,
                opacity: cardOpacity,
              }}
            >
              <span style={{ fontSize: 56 }}>{feat.icon}</span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#fafafa",
                  fontFamily: "sans-serif",
                }}
              >
                {feat.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
