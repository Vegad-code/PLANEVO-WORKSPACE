export type TopBarAccountPresentation =
  | { kind: "identity"; name: string; initials: string }
  | { kind: "settings"; name: "Settings"; initials: null };

export function getTopBarAccountPresentation(identity: {
  userDisplayName: string | null;
  userInitials: string | null;
}): TopBarAccountPresentation {
  const name = identity.userDisplayName?.trim();
  const initials = identity.userInitials?.trim();

  if (name && initials) {
    return { kind: "identity", name, initials };
  }

  return { kind: "settings", name: "Settings", initials: null };
}
