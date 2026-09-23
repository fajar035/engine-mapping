import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

interface Props {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  warn?: string;
  onChange: (v: number) => void;
}

export default function NumField({
  label,
  value,
  unit,
  step = 1,
  min,
  max,
  hint,
  warn,
  onChange,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const parsed = focused ? draft : String(value);

  const commit = (raw?: string) => {
    const txt = raw ?? (focused ? draft : String(value));
    const num = parseFloat(txt.replace(',', '.'));
    let v = Number.isFinite(num) ? num : value;
    // 0 = "belum diisi / tidak tahu" — biarkan kosong, jangan di-clamp ke min
    if (v !== 0) {
      if (min !== undefined) v = Math.max(v, min);
      if (max !== undefined) v = Math.min(v, max);
    }
    onChange(v);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.label}>{label}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          warn && !focused && styles.inputWarn,
        ]}
        value={parsed}
        keyboardType="numeric"
        onFocus={() => {
          setDraft(String(value));
          setFocused(true);
        }}
        onBlur={() => {
          commit();
          setFocused(false);
        }}
        onChangeText={(t) => setDraft(t)}
        onSubmitEditing={() => {
          commit();
          setFocused(false);
        }}
        returnKeyType="done"
      />
      {warn ? <Text style={styles.warnText}>{warn}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md, flex: 1, minWidth: 120 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  label: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', flexShrink: 1 },
  unit: { color: Colors.textDim, fontSize: FontSize.xs, marginLeft: 4 },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  inputFocused: { borderColor: Colors.accent },
  inputWarn: { borderColor: Colors.danger },
  hint: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 3 },
  warnText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 3 },
});