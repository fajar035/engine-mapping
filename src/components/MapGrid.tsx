import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize } from '../theme';

const COL_W = 62;
const ROW_H = 44;
const HEADER_H = 34;
const LABEL_W = 48;

interface Props {
  /** Label baris (kiri), nilai TPS (%). */
  rowLabels: readonly number[];
  /** Label kolom (atas), nilai RPM. */
  colLabels: number[];
  cellMain: (r: number, c: number) => string;
  cellSub?: (r: number, c: number) => string;
  cellSelected?: (r: number, c: number) => boolean;
  colorOf?: (r: number, c: number) => string;
  onEdit: (r: number, c: number) => void;
  /** Ketuk label baris (TPS) → salin satu baris TPS. */
  onCopyRow?: (rowIndex: number) => void;
}

function MapGrid({
  rowLabels,
  colLabels,
  cellMain,
  cellSub,
  cellSelected,
  colorOf,
  onEdit,
  onCopyRow,
}: Props) {
  const totalH = HEADER_H + rowLabels.length * ROW_H;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: COL_W,
      offset: COL_W * index,
      index,
    }),
    [],
  );

  const renderColumn = useCallback(
    ({ index }: { index: number }) => (
      <View style={{ width: COL_W }}>
        <View style={[styles.headerCell, lengthH(HEADER_H)]}>
          <Text style={[styles.cellText, styles.rpmText]}>{colLabels[index]}</Text>
        </View>
        {rowLabels.map((_, r) => {
          const bg = colorOf ? colorOf(r, index) : Colors.cellBg;
          const sel = cellSelected ? cellSelected(r, index) : false;
          const sub = cellSub ? cellSub(r, index) : undefined;
          return (
            <Pressable
              key={r}
              onPress={() => onEdit(r, index)}
              style={[styles.cellBody, lengthH(ROW_H), { backgroundColor: bg }, sel && styles.cellSel]}
            >
              <Text style={styles.cellText}>{cellMain(r, index)}</Text>
              {sub ? (
                <Text style={styles.cellSub} numberOfLines={1}>
                  {sub}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    ),
    [rowLabels, colLabels, cellMain, cellSub, cellSelected, colorOf, onEdit],
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { height: totalH }]}>
        <View style={{ width: LABEL_W }}>
          <View style={[styles.headerCell, lengthH(HEADER_H)]}>
            <Text style={styles.cornerText}>TPS\RPM</Text>
          </View>
          {rowLabels.map((t, r) => (
            <Pressable
              key={t}
              onPress={() => onCopyRow?.(r)}
              style={[styles.labelCell, lengthH(ROW_H)]}
            >
              <Text style={styles.tpsText}>{t}%</Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          horizontal
          style={{ flex: 1 }}
          data={colLabels}
          keyExtractor={(v, i) => String(i)}
          renderItem={renderColumn}
          getItemLayout={getItemLayout}
          initialNumToRender={8}
          maxToRenderPerBatch={12}
          windowSize={5}
          updateCellsBatchingPeriod={40}
          showsHorizontalScrollIndicator={false}
          bounces={false}
        />
      </View>
    </View>
  );
}

function lengthH(h: number) {
  return { height: h };
}

export default React.memo(MapGrid);

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  row: { flexDirection: 'row' },
  headerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    backgroundColor: Colors.tpsHeader,
  },
  cellBody: {
    width: COL_W,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  labelCell: {
    width: LABEL_W,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cellSel: { borderWidth: 2, borderColor: Colors.accent },
  cellText: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center' },
  cornerText: { color: Colors.textDim, fontSize: 9, textAlign: 'center' },
  rpmText: { fontSize: FontSize.xs },
  tpsText: { color: Colors.textDim, fontSize: FontSize.sm, fontWeight: '700' },
  cellSub: { color: Colors.textDim, fontSize: 9, marginTop: 2 },
});