import type { TextStyle } from 'react-native';

import { colors } from './colors';

// Jost 700 is the only weight of the app font (design/tokens.md). It is
// loaded at startup (see features/shell/FontGate.tsx). No fontWeight with it:
// the font file is already bold.
export const fontFamily = { display: 'Jost' } as const;

export const fontAssets = {
  Jost: require('../../../assets/fonts/Jost_700Bold.ttf'),
};

// Jost has tall accents: a line height under 1.45 times the size cuts the
// accents of the capitals. The negative margins keep the layout of the
// mockups (the mockups use 1.2, a browser does not cut).
// Text styles used by the screens of the offline-map phase.
export const text = {
  titleScreen: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    lineHeight: 38,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.brown,
  },
  titleState: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    lineHeight: 35,
    marginVertical: -3,
    color: colors.brown,
  },
  titleName: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 32,
    marginVertical: -3,
    color: colors.brown,
  },
  buttonAction: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    lineHeight: 25,
  },
  sectionLabel: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: -1.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brown2,
  },
  control: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    color: colors.brown,
    fontVariant: ['tabular-nums'],
  },
  secondary: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: colors.brown2,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.brown2,
    fontVariant: ['tabular-nums'],
  },
  attribution: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '400',
    color: colors.brown2,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;
