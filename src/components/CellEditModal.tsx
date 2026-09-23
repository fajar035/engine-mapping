import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  initial: number;
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  onSave: (v: number) => void;
  onClose: () => void;
}

export default function CellEditModal(props: Props) {
  const { visible } = props;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {visible ? <Editor {...props} /> : null}
    </Modal>
  );
}

function Editor({
  title,
  initial,
  unit,
  hint,
  min = 0,
  max = 1000,
  step = 1,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(String(initial));

  const clamp = (v: number) => Math.min(Math.max(v, min), max);

  const commit = () => {
    const num = parseFloat(draft.replace(',', '.'));
    const v = Number.isFinite(num) ? clamp(num) : clamp(initial);
    onSave(Math.round(v * 100) / 100);
    onClose();
  };

  const bump = (dir: number) => {
    const num = parseFloat(draft.replace(',', '.'));
    const base = Number.isFinite(num) ? num : initial;
    setDraft(String(clamp(base + dir * step)));
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.inputRow}>
          <Pressable style={styles.stepBtn} onPress={() => bump(-1)}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            keyboardType="numeric"
            autoFocus
            selectTextOnFocus
            onChangeText={setDraft}
            onSubmitEditing={commit}
          />
          <Pressable style={styles.stepBtn} onPress={() => bump(1)}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
        {unit ? (
          <Text style={styles.hint}>
            Satuan: {unit}
            {hint ? ` • ${hint}` : ''}
          </Text>
        ) : null}
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnText}>Batal</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSave]} onPress={commit}>
            <Text style={[styles.btnText, { color: '#fff' }]}>Simpan</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.lg,
  },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    backgroundColor: Colors.surfaceAlt,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: Colors.accent, fontSize: FontSize.xl, fontWeight: '800' },
  input: {
    flex: 1,
    marginHorizontal: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    color: Colors.text,
    fontSize: FontSize.xl,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  hint: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: Spacing.md },
  btnRow: { flexDirection: 'row', marginTop: Spacing.lg },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: Colors.surfaceAlt, marginRight: Spacing.sm },
  btnSave: { backgroundColor: Colors.accent, marginLeft: Spacing.sm },
  btnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
});