// Colors of the 70s style ("hn" = hors navigation). Source: design/tokens.md.
export const colors = {
  cream: '#F4E4C1',
  creamLight: '#FBF1DA',
  sand: '#F7DDA6',
  brown: '#3A1F0F',
  brown2: '#5A3A28',
  onBrown: '#F4E4C1',
  mustard: '#F0A830',
  mustardPale: '#F6CB7A',
  orange: '#E2652B',
  rust: '#B5452A',
  danger: '#8A1C12',
  success: '#0F5223',
} as const;

// "hn.ombre": 0 2 8, brown at 30 %. Always used with a brown border.
export const shadow = {
  shadowColor: colors.brown,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
} as const;
