import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../theme';

const STORAGE_KEY = 'disclaimer-accepted-v1';

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const val = await AsyncStorage.getItem(STORAGE_KEY);
        if (val !== 'true') setVisible(true);
      } catch {
        setVisible(true);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const accept = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setVisible(false);
  };

  if (checking || !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={accept}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Disclaimer</Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.para}>
              Semua hasil perhitungan di aplikasi ini (Base Map, Fuel Correction,
              Ignition, dan Injector Timing) adalah {'\n'}<Text style={styles.bold}>estimasi berbasis spek mesin</Text>{' '}
              — perhitungan model fisik, {'\n'}<Text style={styles.bold}>bukan hasil pengukuran</Text>{' '}
              dari dyno atau AFR meter di lapangan.
            </Text>
            <Text style={styles.para}>
              Akurasi bergantung pada kebenaran spek yang kamu masukkan dan kondisi
              nyata mesin. Nilai yang dihasilkan dimaksudkan sebagai {'\n'}<Text style={styles.bold}>titik awal tuning</Text>,
              bukan angka final yang dijamin optimal untuk semua kondisi.
            </Text>
            <Text style={styles.para}>
              Kalibrasi akhir tetap harus dilakukan dengan perangkat ukur yang sesuai
              (AFR meter / dyno) dan dengan memperhatikan reaksi serta kondisi mesin.
            </Text>
            <Text style={styles.para}>
              Pengguna bertanggung jawab penuh atas penggunaan hasil perhitungan.
              Gunakan area yang aman saat melakukan uji coba dan perhatikan keselamatan
              berkendara.
            </Text>
          </ScrollView>
          <Pressable style={styles.btn} onPress={accept}>
            <Text style={styles.btnText}>Saya Mengerti</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.xl,
    maxHeight: '80%',
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: Spacing.sm },
  para: {
    color: Colors.textDim,
    fontSize: FontSize.md,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  bold: { color: Colors.text, fontWeight: '700' },
  btn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
});