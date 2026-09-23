import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CellEditModal from '../components/CellEditModal';
import MapGrid from '../components/MapGrid';
import { useEngine } from '../engineState';
import { heat } from '../heat';
import { Colors, FontSize, Spacing } from '../theme';
import { TPS_STEPS } from '../types';
import { useCopy } from '../useCopy';

export default function FuelScreen() {
  const { rpms, baseMap, fuelCorr, setFuel, resetFuel, undo, canUndo, undoDepth } =
    useEngine();
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null);
  const { copiedTps, copiedAll, copy, copyAllMap } = useCopy(rpms);

  const editCell = useCallback((r: number, c: number) => setEdit({ r, c }), []);
  const onSaveCell = useCallback(
    (v: number) => {
      if (edit) setFuel(edit.r, edit.c, v);
    },
    [edit, setFuel],
  );
  const onClose = useCallback(() => setEdit(null), []);

  const grid = useMemo(
    () => ({
      cellMain: (r: number, c: number) =>
        `${fuelCorr[r][c] >= 0 ? '+' : ''}${fuelCorr[r][c].toFixed(0)}%`,
      cellSub: (r: number, c: number) =>
        `=${(baseMap[r][c] * (1 + fuelCorr[r][c] / 100)).toFixed(2)}ms`,
      cellSelected: (r: number, c: number) => fuelCorr[r][c] !== 0,
      colorOf: (r: number, c: number) => heat(fuelCorr[r][c] + 100, 0, 200),
      onCopyRow: (r: number) =>
        copy(TPS_STEPS[r], (c) => `${fuelCorr[r][c].toFixed(0)}`),
      onCopyAll: () =>
        copyAllMap([...TPS_STEPS], (r, c) => `${fuelCorr[r][c].toFixed(0)}`),
    }),
    [baseMap, fuelCorr, copy, copyAllMap],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Fuel Correction (JUKEN)</Text>
        <Text style={styles.subtitle}>
          Koreksi % terhadap Base Map. Nilai akhir injeksi = Base Map × (1 + koreksi/100).
          Ketuk label TPS di kiri untuk salin satu baris TPS.
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.resetBtn} onPress={resetFuel}>
            <Text style={styles.resetText}>Reset ke 0%</Text>
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
      <Text style={styles.footnote}>
        Baris = {TPS_STEPS.length} step TPS (0,2,5,10…100%); kolom = RPM mulai 1000
        (mentok {rpms[rpms.length - 1].toLocaleString('id-ID')}).
      </Text>

      <CellEditModal
        visible={!!edit}
        title={
          edit
            ? `Fuel Corr @ ${rpms[edit.c].toLocaleString('id-ID')} rpm / TPS ${TPS_STEPS[edit.r]}%`
            : ''
        }
        initial={edit ? fuelCorr[edit.r][edit.c] : 0}
        unit="%"
        min={-100}
        max={100}
        step={1}
        hint="0 = pakai Base Map apa adanya"
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
  subtitle: { color: Colors.textDim, fontSize: FontSize.sm, marginTop: 4, marginBottom: Spacing.md, lineHeight: 18 },
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
  footnote: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: Spacing.md, lineHeight: 16 },
});