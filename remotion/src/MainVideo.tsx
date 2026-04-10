import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Scene1Intro } from "./scenes/Scene1";
import { Scene2Features } from "./scenes/Scene2";
import { Scene3HowItWorks } from "./scenes/Scene3";
import { Scene4Stats } from "./scenes/Scene4";
import { Scene5CTA } from "./scenes/Scene5";

const TEAL = "#26c6a0";
const DARK = "#0a0c14";

export const MainVideo = () => {
  const frame = useCurrentFrame();

  // Persistent floating shapes
  const float1 = Math.sin(frame * 0.02) * 20;
  const float2 = Math.cos(frame * 0.015) * 15;
  const float3 = Math.sin(frame * 0.025 + 1) * 25;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* Persistent background gradient */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: -200 + float1,
            right: -100,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${TEAL}15, transparent 70%)`,
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150 + float2,
            left: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${TEAL}10, transparent 70%)`,
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: `translate(-50%, -50%) translateY(${float3}px)`,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${TEAL}08, transparent 60%)`,
            filter: "blur(100px)",
          }}
        />
      </AbsoluteFill>

      {/* Persistent grid lines */}
      <AbsoluteFill style={{ opacity: 0.03 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              top: i * 60,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: TEAL,
            }}
          />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={`v-${i}`}
            style={{
              position: "absolute",
              left: i * 60,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: TEAL,
            }}
          />
        ))}
      </AbsoluteFill>

      {/* Scene transitions */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene1Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene2Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene3HowItWorks />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene4Stats />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene5CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
