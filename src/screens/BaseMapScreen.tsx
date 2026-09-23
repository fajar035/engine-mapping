import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CellEditModal from '../components/CellEditModal';
import MapGrid from '../components/MapGrid';
import { baseMapMs } from '../engine';
import { useEngine } from '../engineState';
import { heat } from '../heat';
import { Colors, FontSize, Spacing } from '../theme';
import { TPS_STEPS } from '../types';
import { useCopy } from '../useCopy';

export default function BaseMapScreen() {
  const { spec, rpms, baseMap, setBaseMap, regenBaseMap, undo, canUndo, undoDepth } =
    useEngine();
  const [edit, setEdit] = useState<{ r: number; c: number } | null>(null);
  const { copiedTps, copiedAll, copy, copyAllMap } = useCopy(rpms);

  const editCell = useCallback((r: number, c: number) => setEdit({ r, c }), []);
  const onSaveCell = useCallback(
    (v: number) => {
      if (edit) setBaseMap(edit.r, edit.c, v);
    },
    [edit, setBaseMap],
  );

  const grid = useMemo(
    () => ({
      cellMain: (r: number, c: number) => `${baseMap[r][c].toFixed(2)}`,
      cellSelected: (r: number, c: number) =>
        Math.abs(baseMap[r][c] - baseMapMs(spec, rpms[c], TPS_STEPS[r])) > 0.05,
      colorOf: (r: number, c: number) => heat(baseMap[r][c], 0.5, 12),
      onCopyRow: (r: number) =>
        copy(TPS_STEPS[r], (c) => `${baseMap[r][c].toFixed(2)}`),
      onCopyAll: () =>
        copyAllMap([...TPS_STEPS], (r, c) => `${baseMap[r][c].toFixed(2)}`),
    }),
    [baseMap, spec, rpms, copy, copyAllMap],
  );

  
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Base Map (JUKEN)</Text>
        <Text style={styles.subtitle}>
          Lama injeksi awal (ms) tiap TPS × RPM — tabel “Base Map” di JUKEN 5++. Digenerate dari
          model airflow (AFR target); sel outline = kamu sudah rubah dari hitungan.
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.btn} onPress={regenBaseMap}>
            <Text style={styles.btnText}>Generate ulang dari spek</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, !canUndo && styles.btnDisabled]}
            disabled={!canUndo}
            onPress={undo}
          >
            <Text style={[styles.btnText, !canUndo && styles.btnDisabledText]}>
              Undo{undoDepth > 0 ? ` (${undoDepth})` : ''}
            </Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnCopy]} onPress={grid.onCopyAll}>
            <Text style={[styles.btnText, styles.btnCopyText]}>Salin Semua</Text>
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

      {copiedTps !== null ? (
        <Text style={styles.copied}>Terkopi: TPS {copiedTps}% → tempel di app JUKEN ✂</Text>
      ) : null}

      {copiedAll && (
        <Text style={styles.copied}>
          Tabel {rpms.length}×{TPS_STEPS.length} (RPM×TPS) terkopi — tempel di app/laptop
        </Text>
      )}
      <Text style={styles.footnote}>
        Baris = {TPS_STEPS.length} step TPS (0,2,5,10…100%) di kiri; kolom = RPM mulai 1000
        (mentok {rpms[rpms.length - 1].toLocaleString('id-ID')}). Durasi ini jadi acuan bagian
        Fuel Correction (koreksi %) dan Injector Timing (derajat).
      </Text>

      <CellEditModal
        visible={!!edit}
        title={
          edit
            ? `Base Map @ ${rpms[edit.c].toLocaleString('id-ID')} rpm / TPS ${TPS_STEPS[edit.r]}%`
            : ''
        }
        initial={edit ? baseMap[edit.r][edit.c] : 0}
        unit="ms"
        min={0.2}
        max={20}
        step={0.1}
        hint="lebih besar = lebih kaya"
        onSave={onSaveCell}
        onClose={() => setEdit(null)}
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
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  btnCopy: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '700' },
  btnDisabledText: { color: Colors.textDim },
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