import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
}

export default function StatCard({ label, value, sub, tone = 'default' }: Props) {
  const color =
    tone === 'ok' ? Colors.ok : tone === 'warn' ? Colors.warn : tone === 'danger' ? Colors.danger : Colors.text;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexBasis: '47%',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexGrow: 1,
  },
  label: { color: Colors.textDim, fontSize: FontSize.xs, marginBottom: 4 },
  value: { fontSize: FontSize.lg, fontWeight: '800' },
  sub: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 4 },
});