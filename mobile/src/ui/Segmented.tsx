import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { border, colors, navColors } from './theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  // Pictogram; receives the color and the size to draw with.
  icon?: (color: string, size: number) => ReactNode;
};

type SegmentedProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Cream: the Settings screen. White: the tracking (mockups v1/80 and 31b).
  variant: 'cream' | 'white';
  accessibilityLabel: string;
};

const LOOK = {
  cream: {
    height: 48,
    borderWidth: border.normal,
    borderColor: colors.brown,
    background: colors.creamLight,
    chosenBackground: colors.brown,
    chosenColor: colors.cream,
    color: colors.brown,
    fontSize: 17,
    fontWeight: '600',
    iconSize: 20,
  },
  white: {
    height: 64,
    borderWidth: 3,
    borderColor: navColors.text,
    background: navColors.background,
    chosenBackground: navColors.text,
    chosenColor: navColors.background,
    color: navColors.text,
    fontSize: 20,
    fontWeight: '700',
    iconSize: 24,
  },
} as const;

// A choice between a few values, one chosen, all shown at once.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const look = LOOK[variant];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.group,
        {
          height: look.height,
          borderRadius: look.height / 2,
          backgroundColor: look.background,
        },
      ]}
    >
      {options.map((option, index) => {
        const chosen = option.value === value;
        const color = chosen ? look.chosenColor : look.color;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: chosen }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: chosen ? look.chosenBackground : undefined,
                borderLeftWidth: index === 0 ? 0 : look.borderWidth,
                borderLeftColor: look.borderColor,
              },
            ]}
          >
            {option.icon?.(color, look.iconSize)}
            <Text
              maxFontSizeMultiplier={1.2}
              style={{
                color,
                fontSize: look.fontSize,
                fontWeight: look.fontWeight,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      {/* The edge is drawn over the segments: the chosen one touches it. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: look.borderWidth,
            borderColor: look.borderColor,
            borderRadius: look.height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', overflow: 'hidden' },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
