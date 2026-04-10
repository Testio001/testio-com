import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const TEAL = "#26c6a0";

const steps = [
  { num: "01", text: "Upload your content" },
  { num: "02", text: "AI processes it" },
  { num: "03", text: "Study smarter" },
];

export const Scene3HowItWorks = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 120 }}>
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
        How it works
      </div>

      <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
        {steps.map((step, i) => {
          const delay = 10 + i * 18;
          const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 150 } });
          const lineWidth = interpolate(frame, [delay + 10, delay + 30], [0, 180], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div
                style={{
                  textAlign: "center",
                  transform: `scale(${s})`,
                  opacity: s,
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${TEAL}30, ${TEAL}10)`,
                    border: `2px solid ${TEAL}50`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <span style={{ fontSize: 36, fontWeight: 700, color: TEAL, fontFamily: "sans-serif" }}>
                    {step.num}
                  </span>
                </div>
                <span style={{ fontSize: 26, color: "#ccc", fontFamily: "sans-serif", fontWeight: 500 }}>
                  {step.text}
                </span>
              </div>
              {i < 2 && (
                <div
                  style={{
                    width: lineWidth,
                    height: 2,
                    background: `linear-gradient(90deg, ${TEAL}60, ${TEAL}10)`,
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
