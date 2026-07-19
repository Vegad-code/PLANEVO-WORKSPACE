import { faCalendar, faFileLines } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DotsSixVertical, Plus, Square } from "@phosphor-icons/react";

type IconProps = {
  className?: string;
};

/** Metadata row — Font Awesome regular, thin line weight. */
export function TaskCardFileIcon({ className }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={faFileLines}
      aria-hidden="true"
      className={className}
      fixedWidth
    />
  );
}

export function TaskCardCalendarIcon({ className }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={faCalendar}
      aria-hidden="true"
      className={className}
      fixedWidth
    />
  );
}

/** Tag chip bullet — small filled square, Lumis craft. */
export function TaskCardTagBullet({ className }: IconProps) {
  return <Square aria-hidden="true" weight="fill" className={className} />;
}

/** Board column add. */
export function TaskBoardPlusIcon({ className }: IconProps) {
  return <Plus aria-hidden="true" weight="light" className={className} />;
}

/** Drag handle — Phosphor six-dot grip, light stroke. */
export function TaskCardDragHandleIcon({ className }: IconProps) {
  return <DotsSixVertical aria-hidden="true" weight="bold" className={className} />;
}
