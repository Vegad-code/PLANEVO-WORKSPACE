import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../tokens.css";

export type SocialReelProps = {
  demoSrc: string;
  title: string;
  cta: string;
  captions?: string[];
};

const CAPTION_SEGMENT_FRAMES = 75;

function resolveDemoSrc(demoSrc: string): string {
  if (demoSrc.startsWith("http://") || demoSrc.startsWith("https://")) {
    return demoSrc;
  }
  return staticFile(demoSrc);
}

export const SocialReel: React.FC<SocialReelProps> = ({
  demoSrc,
  title,
  cta,
  captions = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const captionLines =
    captions.length > 0 ? captions : [title, cta].filter(Boolean);
  const activeCaptionIndex = Math.min(
    Math.floor(frame / CAPTION_SEGMENT_FRAMES),
    captionLines.length - 1,
  );
  const captionText = captionLines[activeCaptionIndex] ?? title;

  const captionLocalFrame = frame % CAPTION_SEGMENT_FRAMES;
  const captionOpacity = interpolate(
    captionLocalFrame,
    [0, 8, CAPTION_SEGMENT_FRAMES - 10, CAPTION_SEGMENT_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames - 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "var(--color-ink)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <AbsoluteFill>
        <OffthreadVideo
          src={resolveDemoSrc(demoSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: 48,
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--color-ink) 80%, transparent), transparent 45%)",
        }}
      >
        <div
          style={{
            opacity: captionOpacity,
            alignSelf: "center",
            backgroundColor: "color-mix(in srgb, var(--color-paper) 92%, transparent)",
            color: "var(--color-ink)",
            padding: "12px 20px",
            borderRadius: "var(--radius-card)",
            fontSize: "var(--text-h2)",
            fontWeight: 500,
            textAlign: "center",
            maxWidth: "90%",
          }}
        >
          {captionText}
        </div>
      </AbsoluteFill>

      <Sequence from={durationInFrames - 45}>
        <AbsoluteFill
          style={{
            opacity: outroOpacity,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "color-mix(in srgb, var(--color-ink) 55%, transparent)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-paper)",
              fontSize: "var(--text-h2)",
              fontWeight: 600,
            }}
          >
            {cta}
          </p>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
