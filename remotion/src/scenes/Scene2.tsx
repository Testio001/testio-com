import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const TEAL = "#26c6a0";

const features = [
  { icon: "📝", label: "Smart Summary", desc: "AI-generated notes from any document" },
  { icon: "🃏", label: "Flashcards", desc: "Auto-created cards for active recall" },
  { icon: "❓", label: "Quizzes", desc: "Test yourself with AI-generated questions" },
  { icon: "🎧", label: "Podcasts", desc: "Listen to your notes as audio podcasts" },
];

export const Scene2Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const headingY = interpolate(frame, [0, 25], [50, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 100 }}>
      <div
        style={{
          fontSize: 68,
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

      <div style={{ display: "flex", gap: 36, justifyContent: "center" }}>
        {features.map((feat, i) => {
          const delay = 20 + i * 15;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
          const cardOpacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={feat.label}
              style={{
                width: 320,
                height: 280,
                borderRadius: 28,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 24,
                transform: `scale(${s}) translateY(${(1 - s) * 40}px)`,
                opacity: cardOpacity,
              }}
            >
              <span style={{ fontSize: 64 }}>{feat.icon}</span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#fafafa",
                  fontFamily: "sans-serif",
                }}
              >
                {feat.label}
              </span>
              <span
                style={{
                  fontSize: 18,
                  color: "#888",
                  fontFamily: "sans-serif",
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                {feat.desc}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
