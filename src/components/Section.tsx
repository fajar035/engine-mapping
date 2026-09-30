import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

interface Props {
  title: string;
  children: React.ReactNode;
  /** true = anak-anak di-render menumpuk vertikal (1 kolom penuh), tidak dijajarkan kesamping */
  block?: boolean;
}

export default function Section({ title, children, block }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {/* flexShrink 1 + minWidth 0: anak yang menolak menyusut tidak boleh
          membuat kartu melebar ke kanan dan menyeret seluruh halaman. */}
      <View style={[styles.body, block && styles.bodyBlock]}>
        <View style={styles.inner}>{children}</View>
      </View>
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
    fontWeight: "700",
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
    alignItems: 'stretch',
    // width 100% + flexShrink 1: tanpa ini, anak yang menolak menyusut membuat
    // kartu ikut melebar ke kanan dan seluruh konten page terdorong keluar layar.
    width: '100%',
    flexShrink: 1,
  },
  bodyBlock: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
    width: '100%',
    flexShrink: 1,
  },
  inner: {
    width: '100%',
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
});