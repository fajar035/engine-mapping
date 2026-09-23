import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CellEditModal from '../components/CellEditModal';
import MapGrid from '../components/MapGrid';
import { baseIgnitionDeg, camEvents } from '../engine';
import { useEngine } from '../engineState';
import { heat } from '../heat';
import { Colors, FontSize, Spacing } from '../theme';
import { TPS_STEPS } from '../types';
import { useCopy } from '../useCopy';

export default function IgnitionScreen() {
  const { spec, rpms, ignition, setIgnition, resetIgnition } = useEngine();
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null);
  const { copiedTps, copiedAll, copy, copyAllMap } = useCopy(rpms);

  const editCell = useCallback((r: number, c: number) => setEdit({ r, c }), []);
  const onSaveCell = useCallback(
    (v: number) => {
      if (edit) setIgnition(edit.r, edit.c, v);
    },
    [edit, setIgnition],
  );
  const onClose = useCallback(() => setEdit(null), []);

  const grid = useMemo(
    () => ({
      cellMain: (r: number, c: number) => `${ignition[r][c].toFixed(1)}°`,
      cellSelected: (r: number, c: number) =>
        Math.abs(ignition[r][c] - baseIgnitionDeg(spec, rpms[c], TPS_STEPS[r])) > 0.2,
      colorOf: (r: number, c: number) => heat(ignition[r][c], 4, 40),
      onCopyRow: (r: number) =>
        copy(TPS_STEPS[r], (c) => `${ignition[r][c].toFixed(1)}`),
      onCopyAll: () =>
        copyAllMap([...TPS_STEPS], (r, c) => `${ignition[r][c].toFixed(1)}`),
    }),
    [ignition, spec, rpms, copy, copyAllMap],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Ignition Timing (JUKEN)</Text>
        <Text style={styles.subtitle}>
          Derajat pengapian sebelum TMA (°BTDC) tiap TPS × RPM — layout sama dengan tabel
          «Ignition Timing» di app JUKEN 5++ (TPS kiri, RPM atas). Ketuk label TPS di kiri untuk
          salin baris.
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.resetBtn} onPress={resetIgnition}>
            <Text style={styles.resetText}>Generate Baseline</Text>
          </Pressable>
          <Pressable style={[styles.resetBtn, styles.btnCopy]} onPress={grid.onCopyAll}>
            <Text style={[styles.resetText, styles.btnCopyText]}>Salin Semua</Text>
          </Pressable>
        </View>
      </View>

      <MapGrid
        rowLabels={TPS_STEPS}
        colLabels={rpms}
        cellMain={grid.cellMain}
        cellSelected={grid.cellSelected}
        colorOf={grid.colorOf}
        onEdit={editCell}
        onCopyRow={grid.onCopyRow}
      />

      {copiedAll && (
        <Text style={styles.copied}>
          Tabel {rpms.length}×{TPS_STEPS.length} (RPM×TPS) terkopi — tempel di app/laptop
        </Text>
      )}
      {copiedTps !== null ? (
        <Text style={styles.copied}>Terkopi: TPS {copiedTps}% → tempel di app JUKEN ✂</Text>
      ) : null}

      <View style={styles.notesBox}>
        <Text style={styles.notesTitle}>Baseline WOT per RPM</Text>
        {rpms.map((rpm) => (
          <View key={rpm} style={styles.noteRow}>
            <Text style={styles.noteKey}>{rpm.toLocaleString('id-ID')} rpm</Text>
            <Text style={styles.noteVal}>{baseIgnitionDeg(spec, rpm, 100).toFixed(1)}° BTDC</Text>
          </View>
        ))}
        <Text style={styles.footnote}>
          Baseline memperhitungkan CR {spec.compressionRatio}:1, oktan {spec.octane} RON, dan
          overlap noken {camEvents(spec).overlap.toFixed(0)}°. Catatan manual JUKEN: nilai advance
          di program selalu ditambah titik acuan 9° (contoh tampil 6° = aktual 15°).
        </Text>
      </View>

      <CellEditModal
        visible={!!edit}
        title={
          edit
            ? `Ignition @ ${rpms[edit.c].toLocaleString('id-ID')} rpm / TPS ${TPS_STEPS[edit.r]}%`
            : ''
        }
        initial={edit ? ignition[edit.r][edit.c] : 0}
        unit="° BTDC"
        min={0}
        max={60}
        step={0.5}
        hint="terlalu maju = detonasi"
        onSave={onSaveCell}
        onClose={onClose}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  header: { marginBottom: Spacing.lg },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  subtitle: { color: Colors.textDim, fontSize: FontSize.sm, marginTop: 4, marginBottom: Spacing.md },
  resetBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  resetText: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btnCopy: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  btnCopyText: { color: '#111' },
  copied: {
    color: Colors.ok,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  notesBox: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: Spacing.lg,
  },
  notesTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.sm },
  noteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  noteKey: { color: Colors.textDim, fontSize: FontSize.sm },
  noteVal: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  footnote: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: Spacing.md, lineHeight: 16 },
});