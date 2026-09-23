import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CellEditModal from '../components/CellEditModal';
import MapGrid from '../components/MapGrid';
import { afrFor, calibrationCorrPct } from '../engine';
import { useEngine } from '../engineState';
import { heat } from '../heat';
import { Colors, FontSize, Spacing } from '../theme';
import { TPS_STEPS } from '../types';
import { useCopy } from '../useCopy';

export default function CalibrationScreen() {
  const {
    spec,
    rpms,
    afrMeasured,
    setAfrMeasured,
    clearAfrMeasured,
    applyCalibration,
    fuelCorr,
    undo,
    canUndo,
    undoDepth,
  } = useEngine();
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null);
  const { copiedTps, copiedAll, copy, copyAllMap } = useCopy(rpms);

  const targetOf = useCallback(
    (r: number, c: number) => afrFor(spec, rpms[c], TPS_STEPS[r]),
    [spec, rpms],
  );
  const corrPct = useCallback(
    (r: number, c: number) => calibrationCorrPct(spec, rpms[c], TPS_STEPS[r], afrMeasured[r][c]),
    [spec, rpms, afrMeasured],
  );

  const editCell = useCallback((r: number, c: number) => setEdit({ r, c }), []);
  const onClose = useCallback(() => setEdit(null), []);
  const onSaveCell = useCallback(
    (v: number) => {
      if (edit) setAfrMeasured(edit.r, edit.c, v);
    },
    [edit, setAfrMeasured],
  );

  const countMeasured = useMemo(() => {
    let n = 0;
    for (const row of afrMeasured) for (const v of row) if (v > 0) n++;
    return n;
  }, [afrMeasured]);

  const grid = useMemo(
    () => ({
      cellMain: (r: number, c: number) =>
        afrMeasured[r][c] > 0
          ? `${corrPct(r, c) >= 0 ? '+' : ''}${corrPct(r, c).toFixed(0)}%`
          : '·',
      cellSub: (r: number, c: number) =>
        afrMeasured[r][c] > 0
          ? `ukur ${afrMeasured[r][c].toFixed(1)} / target ${targetOf(r, c).toFixed(1)}`
          : `target ${targetOf(r, c).toFixed(1)}`,
      cellSelected: (r: number, c: number) =>
        afrMeasured[r][c] > 0 &&
        Math.abs(corrPct(r, c) - fuelCorr[r][c]) > 0.5,
      colorOf: (r: number, c: number) => {
        if (afrMeasured[r][c] <= 0) return Colors.cellBg;
        return heat(corrPct(r, c) + 100, 60, 140);
      },
      onCopyRow: (r: number) =>
        copy(
          TPS_STEPS[r],
          (c) => `${afrMeasured[r][c] > 0 ? afrMeasured[r][c].toFixed(1) : ''}`,
        ),
      onCopyAll: () =>
        copyAllMap([...TPS_STEPS], (r, c) =>
          afrMeasured[r][c] > 0 ? afrMeasured[r][c].toFixed(1) : '',
        ),
    }),
    [afrMeasured, corrPct, targetOf, fuelCorr, copy, copyAllMap],
  );

  const onApply = () => {
    if (countMeasured === 0) {
      Alert.alert('Belum ada data', 'Isi AFR terukur dulu (ketuk sel) sebelum menerapkan.');
      return;
    }
    const applied = applyCalibration();
    Alert.alert(
      'Koreksi diterapkan',
      `${applied} sel AFR terukur dikonversi ke Fuel Correction (%). Cek tab Fuel Corr untuk hasil & fine-tune manual.`,
    );
  };

  const onClear = () => {
    if (countMeasured === 0) return;
    Alert.alert('Reset data kalibrasi', 'Hapus semua AFR terukur?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: clearAfrMeasured },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Kalibrasi AFR (dari AFR meter)</Text>
        <Text style={styles.subtitle}>
          Isi AFR yang TERUKUR (AFR meter / dyno) tiap sel — app membandingkan dengan target
          dan menghitung koreksi fuel %. Ketuk sel → masukkan angka AFR. Ketuk label TPS →
          salin baris.
        </Text>
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { borderColor: Colors.accent }]}>
            <Text style={styles.statVal}>{countMeasured}</Text>
            <Text style={styles.statLabel}>sel terukur</Text>
          </View>
          <View style={[styles.statChip, { borderColor: Colors.ok }]}>
            <Text style={styles.statVal}>+% = banyakin bensin</Text>
            <Text style={styles.statLabel}>AFR kurus</Text>
          </View>
          <View style={[styles.statChip, { borderColor: Colors.tabActive }]}>
            <Text style={styles.statVal}>-% = kurangin</Text>
            <Text style={styles.statLabel}>AFR kaya</Text>
          </View>
        </View>
        <View style={styles.btnRow}>
          <Pressable style={styles.resetBtn} onPress={onApply}>
            <Text style={styles.resetText}>Terapkan ke Fuel</Text>
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
            <Text style={[styles.resetText, styles.btnCopyText]}>Salin AFR</Text>
          </Pressable>
          <Pressable
            style={[styles.resetBtn, countMeasured === 0 && styles.btnDisabled]}
            disabled={countMeasured === 0}
            onPress={onClear}
          >
            <Text
              style={[
                styles.resetText,
                countMeasured === 0 ? styles.btnDisabledText : styles.btnDangerText,
              ]}
            >
              Bersih
            </Text>
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
          Tabel {rpms.length}×{TPS_STEPS.length} (RPM×TPS) AFR terukur terkopi
        </Text>
      )}
      {copiedTps !== null ? (
        <Text style={styles.copied}>Terkopi: TPS {copiedTps}% → tempel ✂</Text>
      ) : null}

      <View style={styles.notesBox}>
        <Text style={styles.notesTitle}>Cara pakai</Text>
        <Text style={styles.noteText}>
          1. Pastikan Base Map & Fuel Correction sudah berisi nilaimu (spesial setelah
          Generate).{' '}
        </Text>
        <Text style={styles.noteText}>
          2. Breadboard di torekan {spec.name || 'motormu'}: pasang AFR meter, catat AFR terukur
          saat kondisi stabil per bukaan TPS dan rpm catcher.
        </Text>
        <Text style={styles.noteText}>
          3. Isi AFR terukur di sel yang sama kondisi pengukurannya (TPS × RPM).
        </Text>
        <Text style={styles.noteText}>
          4. Tekan «Terapkan ke Fuel» — sel terukur menjadi koreksi % di Fuel Corr, sel lain
          tidak diubah. {`Rumus: koreksi = (terukur / target − 1) × 100.`}
        </Text>
        <Text style={styles.footnote}>
          Sel yang outline = koreksi terhitung belum sesuai Fuel Corr saat ini (belum
          diterapkan / sudah diedit). Koreksi diterapkan nilainya langsung (bukan tambah) ke
          Fuel Correction.
        </Text>
      </View>

      <CellEditModal
        visible={!!edit}
        title={
          edit
            ? `AFR terukur @ ${rpms[edit.c].toLocaleString('id-ID')} rpm / TPS ${TPS_STEPS[edit.r]}%`
            : ''
        }
        initial={edit ? afrMeasured[edit.r][edit.c] : 0}
        unit="AFR"
        min={8}
        max={20}
        step={0.1}
        hint="mis. 13.8 = kurus; 12.0 = kaya. 0 = hapus."
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
  subtitle: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  statChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceAlt,
  },
  statVal: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  statLabel: { color: Colors.textDim, fontSize: FontSize.xs },
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
  btnRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  btnCopy: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  btnCopyText: { color: '#111' },
  btnDisabled: { opacity: 0.4 },
  btnDisabledText: { color: Colors.textDim },
  btnDangerText: { color: Colors.danger },
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
  notesTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800', marginBottom: Spacing.sm },
  noteText: { color: Colors.textDim, fontSize: FontSize.xs, lineHeight: 17, marginBottom: Spacing.xs },
  footnote: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: Spacing.sm,
  },
});