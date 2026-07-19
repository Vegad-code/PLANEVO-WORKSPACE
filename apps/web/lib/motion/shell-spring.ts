import type { Transition } from "framer-motion"

/** Spring tuned to feel equivalent to --sidebar-motion-duration-enter (280ms). */
export const shellLayoutSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 36,
  mass: 0.8,
}

export const shellLayoutInstant: Transition = {
  duration: 0,
}

export function getShellLayoutTransition(
  prefersReducedMotion: boolean,
): Transition {
  return prefersReducedMotion ? shellLayoutInstant : shellLayoutSpring
}
