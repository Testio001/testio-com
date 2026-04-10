import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

const steps = [
  { num: "01", text: "Upload any document", sub: "PDF, text, slides — anything" },
  { num: "02", text: "AI processes it", sub: "Smart extraction & analysis" },
  { num: "03", text: "Get study tools", sub: "Notes, flashcards, quizzes & podcasts" },
  { num: "04", text: "Study & ace it", sub: "Track progress with streaks & badges" },
];

export const Scene3HowItWorks = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 120 }}>
      <div
        style={{
          fontSize: 60,
          fontWeight: 800,
          color: "#fafafa",
          fontFamily: "sans-serif",
          letterSpacing: -2,
          marginBottom: 90,
          opacity: headingOpacity,
          textAlign: "center",
        }}
      >
        How it <span style={{ color: TEAL }}>works</span>
      </div>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {steps.map((step, i) => {
          const delay = 12 + i * 20;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 150 } });
          const lineWidth = i < 3 ? interpolate(frame, [delay + 15, delay + 35], [0, 120], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) : 0;

          return (
            <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <div
                style={{
                  textAlign: "center",
                  transform: `scale(${s})`,
                  opacity: s,
                  minWidth: 180,
                }}
              >
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${TEAL}30, ${TEAL}10)`,
                    border: `2px solid ${TEAL}50`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <span style={{ fontSize: 32, fontWeight: 700, color: TEAL, fontFamily: "sans-serif" }}>
                    {step.num}
                  </span>
                </div>
                <span style={{ fontSize: 22, color: "#eee", fontFamily: "sans-serif", fontWeight: 600, display: "block" }}>
                  {step.text}
                </span>
                <span style={{ fontSize: 16, color: "#666", fontFamily: "sans-serif", fontWeight: 400, marginTop: 6, display: "block" }}>
                  {step.sub}
                </span>
              </div>
              {i < 3 && (
                <div
                  style={{
                    width: lineWidth,
                    height: 2,
                    background: `linear-gradient(90deg, ${TEAL}60, ${TEAL}10)`,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
