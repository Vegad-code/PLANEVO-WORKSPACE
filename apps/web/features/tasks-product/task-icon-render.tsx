import type { TaskIconDefinition, TaskIconStyle } from "@planevo/core/tasks/task-icon-types";
import { faFileLines } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Bug,
  Cube,
  FolderSimple,
  Folders,
  Gear,
  MagnifyingGlass,
  PaintBrush,
  PencilSimple,
  RocketLaunch,
  SquaresFour,
  User,
  UsersThree,
} from "@phosphor-icons/react";
import {
  taskIconDisplayClass,
  type TaskIconDisplaySize,
} from "./task-icon-display-size";

type TaskIconRenderProps = {
  definition: TaskIconDefinition;
  active?: boolean;
  className?: string;
  style?: TaskIconStyle;
  size?: TaskIconDisplaySize;
};

function phosphorWeight(active: boolean) {
  return active ? "duotone" : "light";
}

function CatalogSvg({
  definition,
  className,
  active = false,
}: TaskIconRenderProps) {
  const catalog = definition.catalog;
  if (!catalog) return null;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${catalog.width} ${catalog.height}`}
      className={`${className ?? ""} text-current ${active ? "opacity-90" : ""}`}
      fill="currentColor"
    >
      <path d={catalog.svgPath} />
    </svg>
  );
}

function TaskEmojiRender({
  emoji,
  className,
}: {
  emoji: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`font-apple-emoji inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
    >
      {emoji}
    </span>
  );
}

export function TaskIconRender({
  definition,
  active = false,
  className,
  style = "plain",
  size,
}: TaskIconRenderProps) {
  const resolvedClassName =
    className ?? (size ? taskIconDisplayClass(style, size) : undefined);
  if (style === "emoji" && definition.emoji) {
    return <TaskEmojiRender emoji={definition.emoji} className={resolvedClassName} />;
  }

  if (definition.library === "emoji" && definition.emoji) {
    return <TaskEmojiRender emoji={definition.emoji} className={resolvedClassName} />;
  }

  if (definition.catalog) {
    return (
      <CatalogSvg
        definition={definition}
        active={active}
        className={resolvedClassName}
        style={style}
      />
    );
  }

  if (definition.library === "fontawesome") {
    if (definition.name === "faFileLines") {
      return (
        <FontAwesomeIcon
          icon={faFileLines}
          aria-hidden="true"
          className={resolvedClassName}
          fixedWidth
        />
      );
    }
    return null;
  }

  const weight = phosphorWeight(active);

  switch (definition.name) {
    case "FolderSimple":
      return (
        <FolderSimple aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "RocketLaunch":
      return (
        <RocketLaunch aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "PaintBrush":
      return (
        <PaintBrush aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "Cube":
      return <Cube aria-hidden="true" weight={weight} className={resolvedClassName} />;
    case "User":
      return <User aria-hidden="true" weight={weight} className={resolvedClassName} />;
    case "SquaresFour":
      return (
        <SquaresFour aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "Bug":
      return <Bug aria-hidden="true" weight={weight} className={resolvedClassName} />;
    case "UsersThree":
      return (
        <UsersThree aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "MagnifyingGlass":
      return (
        <MagnifyingGlass
          aria-hidden="true"
          weight={weight}
          className={resolvedClassName}
        />
      );
    case "Gear":
      return <Gear aria-hidden="true" weight={weight} className={resolvedClassName} />;
    case "PencilSimple":
      return (
        <PencilSimple aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    case "Folders":
      return (
        <Folders aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
    default:
      return (
        <FolderSimple aria-hidden="true" weight={weight} className={resolvedClassName} />
      );
  }
}
