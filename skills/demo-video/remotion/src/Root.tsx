import { Composition } from "remotion";
import { LaunchVideo } from "./compositions/LaunchVideo";
import { SocialReel } from "./compositions/SocialReel";

const FPS = 30;
const DEMO_FRAMES = 150;
const INTRO_FRAMES = 45;
const OUTRO_FRAMES = 60;

export const RemotionRoot: React.FC = () => {
  const defaultDemo =
    process.env.PLANEVO_DEMO_SRC ??
    "http://localhost:3000";

  return (
    <>
      <Composition
        id="LaunchVideo"
        component={LaunchVideo}
        durationInFrames={INTRO_FRAMES + DEMO_FRAMES + OUTRO_FRAMES}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{
          demoSrc: defaultDemo,
          title: "Create tasks in seconds",
          cta: "Try Planevo",
          captions: [],
        }}
      />
      <Composition
        id="SocialReel"
        component={SocialReel}
        durationInFrames={DEMO_FRAMES + 45}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          demoSrc: defaultDemo,
          title: "Create tasks in seconds",
          cta: "planevo.com",
          captions: ["Organize your work", "Tasks in seconds", "Try Planevo"],
        }}
      />
    </>
  );
};
