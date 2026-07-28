import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../tokens.css";

export type LaunchVideoProps = {
  demoSrc: string;
  title: string;
  cta: string;
  captions?: string[];
};

const INTRO_FRAMES = 45;
const OUTRO_FRAMES = 60;

function resolveDemoSrc(demoSrc: string): string {
  if (demoSrc.startsWith("http://") || demoSrc.startsWith("https://")) {
    return demoSrc;
  }
  return staticFile(demoSrc);
}

export const LaunchVideo: React.FC<LaunchVideoProps> = ({
  demoSrc,
  title,
  cta,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const introOpacity = interpolate(frame, [0, 12, INTRO_FRAMES - 8, INTRO_FRAMES], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const introY = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const outroStart = durationInFrames - OUTRO_FRAMES;
  const outroOpacity = interpolate(
    frame,
    [outroStart, outroStart + 12, durationInFrames],
    [0, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const demoStart = INTRO_FRAMES;
  const demoEnd = durationInFrames - OUTRO_FRAMES;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "var(--color-paper)",
        color: "var(--color-ink)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <Sequence from={demoStart} durationInFrames={demoEnd - demoStart}>
        <AbsoluteFill>
          <OffthreadVideo
            src={resolveDemoSrc(demoSrc)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: "var(--color-sidebar)",
            }}
          />
        </AbsoluteFill>
      </Sequence>

      <AbsoluteFill
        style={{
          opacity: introOpacity,
          transform: `translateY(${(1 - introY) * 24}px)`,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "var(--color-paper)",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 720, padding: 48 }}>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-label)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              fontWeight: 500,
            }}
          >
            Planevo
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "var(--text-h1)",
              fontWeight: 500,
              lineHeight: 1.2,
              color: "var(--color-ink)",
            }}
          >
            {title}
          </h1>
          <div
            style={{
              margin: "24px auto 0",
              width: 48,
              height: 4,
              borderRadius: 999,
              backgroundColor: "var(--color-marigold)",
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: outroOpacity,
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 80,
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--color-ink) 72%, transparent), transparent 55%)",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--color-marigold)",
            color: "var(--color-marigold-foreground)",
            padding: "14px 28px",
            borderRadius: "var(--radius-card)",
            fontSize: "var(--text-body)",
            fontWeight: 600,
          }}
        >
          {cta}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
