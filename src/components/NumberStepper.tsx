import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
};

export function NumberStepper({ value, onChange, min, max, step = 1, suffix, width = 110 }: Props) {
  const clamp = (n: number) => {
    let v = n;
    if (typeof min === 'number') v = Math.max(min, v);
    if (typeof max === 'number') v = Math.min(max, v);
    return v;
  };
  return (
    <View style={[styles.row, { width }]}>
      <Pressable style={styles.btn} onPress={() => onChange(clamp(value - step))}>
        <Text style={styles.btnTxt}>-</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={String(value)}
        keyboardType="numeric"
        onChangeText={(t) => {
          const n = parseFloat(t.replace(',', '.'));
          if (!Number.isFinite(n)) return;
          onChange(clamp(n));
        }}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      <Pressable style={styles.btn} onPress={() => onChange(clamp(value + step))}>
        <Text style={styles.btnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    width: 30,
    height: 30,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  input: {
    flex: 1,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  suffix: { color: colors.textMuted, marginRight: spacing.xs },
});
