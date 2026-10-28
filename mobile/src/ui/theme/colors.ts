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
  olive: '#A9B56A',
  petrol: '#2D6A66',
} as const;

// Colors of the cyclist ("perso.*"). Source: design/tokens.md.
export const characterColors = {
  skin: '#D9956A',
  skinShadow: '#B97A52',
  jerseyShadow: '#8E3520',
} as const;

// "hn.ombre": 0 2 8, brown at 30 %. Always used with a brown border.
export const shadow = {
  shadowColor: colors.brown,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
} as const;

// Sheet laid over the map (mockup 10): 0 -2 10, brown at 22 %.
export const sheetShadow = {
  shadowColor: colors.brown,
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 8,
} as const;

// Markers of the route (mockup 10): 0 1 3, black at 35 %.
export const markerShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.35,
  shadowRadius: 3,
  elevation: 3,
} as const;

// Colors of the map ("carte.*"). Source: design/tokens.md and
// design/style-carte.md.
export const mapColors = {
  background: '#EEEBE4',
  wood: '#D3E4C0',
  meadow: '#E4E9D0',
  built: '#E3DCD0',
  building: '#D6CCBD',
  water: '#A8CCDD',
  stream: '#7DB0CB',
  road: '#FFFFFF',
  roadCasing: '#BFB7AA',
  track: '#7A4A1E',
  path: '#C62828',
  footway: '#A89F92',
  steps: '#6B5E52',
  rail: '#9A9387',
  contour: '#C9B293',
  contourMajor: '#B89C78',
  hillshadeShadow: '#4A3F35',
  hillshadeLight: 'rgba(255, 255, 255, 0.6)',
  label: '#111111',
  label2: '#4A4A4A',
  elevation: '#5A3A28',
  waterText: '#174B63',
  labelHalo: '#FFFFFF',
  position: '#1A73E8',
  positionBorder: '#FFFFFF',
  // hn.creme-clair at 88 %, behind the attributions.
  attributionBackground: 'rgba(251, 241, 218, 0.88)',
  // carte.itineraire, carte.itineraire-lisere, carte.depart, carte.arrivee
  route: '#C2007A',
  routeCasing: '#FFFFFF',
  // carte.liaison: same magenta, no casing.
  routeLink: '#C2007A',
  start: '#146C2E',
  end: '#111111',
  zoneBorder: colors.brown,
  // hn.voile-hors-zone: #CFC8BB at 72 %.
  outsideVeil: '#CFC8BB',
  outsideVeilOpacity: 0.72,
} as const;
