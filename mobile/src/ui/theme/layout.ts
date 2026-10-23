// Spacing, borders, radii and touch targets. Source: design/tokens.md.
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
  s12: 48,
} as const;

export const border = {
  normal: 2.5, // hn.bord
  strong: 3, // hn.bord-fort
} as const;

export const radius = {
  button48: 24,
  button56: 28,
  card: 22,
  box: 18,
  round: 999,
} as const;

export const target = {
  stop: 48, // cible.arret
  mainButton: 56, // cible.bouton-principal
} as const;

// Tab bar pill (the bar height is computed in features/shell).
export const tabBar = {
  pillWidth: 64,
  pillHeight: 32,
} as const;
