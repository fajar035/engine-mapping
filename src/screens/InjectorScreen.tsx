import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CellEditModal from '../components/CellEditModal';
import MapGrid from '../components/MapGrid';
import { baseEoiDeg, injectionDegrees } from '../engine';
import { useEngine } from '../engineState';
import { heat } from '../heat';
import { Colors, FontSize, Spacing } from '../theme';
import { TPS_STEPS } from '../types';
import { useCopy } from '../useCopy';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default function InjectorScreen() {
  const { spec, rpms, baseMap, injOffset, setInjOffset, resetInj, undo, canUndo, undoDepth } =
    useEngine();
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null);
  const { copiedTps, copiedAll, copy, copyAllMap } = useCopy(rpms);
  const baseEoi = useMemo(() => baseEoiDeg(spec), [spec]);

  const editCell = useCallback((r: number, c: number) => setEdit({ r, c }), []);
  const close = useCallback(() => setEdit(null), []);

  // EOI mutlak (°BTDC) = baseline (injeksi berakhir saat IVO) + offset
  const eoiAt = useCallback(
    (r: number, c: number) => baseEoi + injOffset[r][c],
    [baseEoi, injOffset],
  );
  // Durasi injeksi dalam derajat crank, dari Base Map (ms) yang sudah di-tune
  const durDeg = useCallback(
    (r: number, c: number) => injectionDegrees(baseMap[r][c] ?? 0, rpms[c]),
    [baseMap, rpms],
  );
  // Injector Timing (JUKEN): sudut MULAI injeksi, kerangka 0° = TMA ignisi,
  // dihitung mundur dari posisi EOI. RPM makin tinggi nilai mendekati 0 (sama dgn JUKEN).
  const itStart = useCallback(
    (r: number, c: number) => clamp(Math.round(360 - eoiAt(r, c) - durDeg(r, c)), 0, 360),
    [eoiAt, durDeg],
  );

  const onSaveCell = useCallback(
    (v: number) => {
      if (!edit) return;
      const offset = 360 - v - durDeg(edit.r, edit.c) - baseEoi;
      setInjOffset(edit.r, edit.c, offset);
    },
    [edit, durDeg, baseEoi, setInjOffset],
  );

  const grid = useMemo(
    () => ({
      cellMain: (r: number, c: number) => `${itStart(r, c)}°`,
      cellSub: (r: number, c: number) =>
        `EOI ${eoiAt(r, c).toFixed(0)} • ${durDeg(r, c).toFixed(0)}°`,
      cellSelected: (r: number, c: number) => Math.abs(injOffset[r][c]) > 0.4,
      colorOf: (r: number, c: number) => heat(injOffset[r][c], -60, 60),
      onCopyRow: (r: number) => copy(TPS_STEPS[r], (c) => `${itStart(r, c)}`),
      onCopyAll: () =>
        copyAllMap([...TPS_STEPS], (r, c) => `${itStart(r, c)}`),
    }),
    [itStart, eoiAt, durDeg, injOffset, copy, copyAllMap],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Injector Timing (JUKEN)</Text>
        <Text style={styles.subtitle}>
          Sudut mulai injeksi (° putaran mesin, dari titik acuan 0 = TMA ignisi) — layout sama
          dengan tabel «Injector Timing» di app JUKEN 5++.
        </Text>
        <Text style={styles.subtitle}>
          Baseline: injeksi berakhir tepat saat klep intake mulai buka (IVO {baseEoi}° BTDC). RPM
          tinggi → nilai menuju 0 karena debit lebih besar.
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.resetBtn} onPress={resetInj}>
            <Text style={styles.resetText}>Reset ke Baseline</Text>
          </Pressable>
          <Pressable
            style={[styles.resetBtn, !canUndo && styles.btnDisabled]}
            disabled={!canUndo}
            onPress={undo}
          >
            <Text style={[styles.resetText, !canUndo && styles.btnDisabledText]}>
              Undo{undoDepth > 0 ? ` (${undoDepth})` : ''}
            </Text>
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
        cellSub={grid.cellSub}
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
        <Text style={styles.notesTitle}>Rotasi IT @ WOT per RPM</Text>
        {rpms.map((rpm, c) => (
          <View key={rpm} style={styles.noteRow}>
            <Text style={styles.noteKey}>{rpm.toLocaleString('id-ID')} rpm</Text>
            <Text style={styles.noteVal}>
              IT {itStart(TPS_STEPS.length - 1, c)}° • dur {durDeg(TPS_STEPS.length - 1, c).toFixed(0)}°
            </Text>
          </View>
        ))}
        <Text style={styles.footnote}>
          Durasi diambil dari Base Map (ms) di kolom RPM yang sama, konversi: derajat = ms × RPM ×
          0.006. Referensi sudut JUKEN bisa di-offset via injPhaseOffset di Setup bila nilai yang
          disalin dianggap bergeser dari referensi ECU.
        </Text>
      </View>

      <CellEditModal
        visible={!!edit}
        title={
          edit
            ? `Injector Timing @ ${rpms[edit.c].toLocaleString('id-ID')} rpm / TPS ${TPS_STEPS[edit.r]}%`
            : ''
        }
        initial={edit ? itStart(edit.r, edit.c) : 0}
        unit="° (dari 0 = TMA ignisi)"
        min={0}
        max={360}
        step={1}
        hint="ubah sudut mulai injeksi"
        onSave={onSaveCell}
        onClose={close}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  header: { marginBottom: Spacing.lg },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  subtitle: { color: Colors.textDim, fontSize: FontSize.sm, marginTop: 4, marginBottom: Spacing.sm },
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
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btnDisabled: { opacity: 0.4 },
  btnDisabledText: { color: Colors.textDim },
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