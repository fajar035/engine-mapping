import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Section({ title, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  body: {
    padding: Spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});