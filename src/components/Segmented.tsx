import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * Compact single-choice control. `wrap` lets a long option list break onto
 * several lines instead of squeezing every label to two characters.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  wrap,
  grow,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
  grow?: boolean;
}) {
  return (
    <View style={[styles.seg, wrap && styles.segWrap]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.item, grow && styles.itemGrow, active && styles.itemActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    padding: 2,
  },
  segWrap: { flexWrap: 'wrap' },
  item: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.sm },
  itemGrow: { flexGrow: 1, alignItems: 'center' },
  itemActive: { backgroundColor: colors.accent },
  text: { color: colors.textMuted, fontSize: 13 },
  textActive: { color: colors.textPrimary, fontWeight: '600' },
});
