import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Section from '../components/Section';
import { Colors, FontSize, Spacing } from '../theme';

interface GuideItem {
  label: string;
  unit: string;
  desc: string;
}

interface GuideGroup {
  title: string;
  note?: string;
  items: GuideItem[];
}

const GROUPS: GuideGroup[] = [
  {
    title: 'Noken As & Klep',
    note: 'Klep = pintu masuk/keluar udara. Noken as = pengatur kapan pintu itu buka-tutup.',
    items: [
      { label: 'IN Buka', unit: '° BTDC', desc: 'Kapan klep hisap mulai membuka, diukur sebelum piston mencapai titik mati atas.' },
      { label: 'IN Tutup', unit: '° ABDC', desc: 'Kapan klep hisap menutup, setelah piston melewati titik mati bawah.' },
      { label: 'EX Buka', unit: '° BBDC', desc: 'Kapan klep buang mulai membuka, sebelum piston mencapai titik mati bawah.' },
      { label: 'EX Tutup', unit: '° ATDC', desc: 'Kapan klep buang menutup, setelah piston melewati titik mati atas.' },
      { label: 'Lift Intake', unit: 'mm', desc: 'Tinggi angkat maksimum klep hisap. Makin besar makin banyak udara masuk (kalau noken racing).' },
      { label: 'Lift Exhaust', unit: 'mm', desc: 'Tinggi angkat maksimum klep buang. Makin besar makin lancar gas buang keluar.' },
    ],
  },
  {
    title: 'Mesin',
    items: [
      { label: 'Bore', unit: 'mm', desc: 'Diameter lubang silinder — garis tengah tempat piston bergerak.' },
      { label: 'Stroke', unit: 'mm', desc: 'Jarak tempuh piston dari titik mati atas ke titik mati bawah.' },
      { label: 'Over Size', unit: 'mm', desc: 'Tambahan diameter dari piston oversize (0.25 / 0.50 dst). Bore nyata = bore + oversize.' },
      { label: 'Silinder', unit: 'bh', desc: 'Jumlah silinder mesin (motor umumnya 1).' },
      { label: 'Rasio Kompresi', unit: ':1', desc: 'Seberapa kuat campuran bensin ditekan sebelum dibakar. Makin tinggi makin rawan ketukan (butuh bensin oktan tinggi).' },
    ],
  },
  {
    title: 'Injector & TB',
    note: 'Injector = penyemprot bensin. TB (throttle body) = pintu masuk udara (karbu-nya motor injeksi).',
    items: [
      { label: 'Flow Injektor', unit: 'cc/min', desc: 'Kapasitas maksimum semprotan bensin per menit (tertulis di badan injector, biasanya diukur pada tekanan 3 bar).' },
      { label: 'Jumlah', unit: 'bh', desc: 'Banyaknya injector terpasang.' },
      { label: 'Tekanan Bensin', unit: 'bar', desc: 'Tekanan bensin di jalur menuju injector. Makin tinggi, semprotan makin deras.' },
      { label: 'Dead Time', unit: 'ms', desc: 'Jeda antara injector diperintah nyala sampai bensin benar-benar keluar (reaksi mekanik).' },
      { label: 'Diameter TB', unit: 'mm', desc: 'Ukuran lubang body kolter tempat udara masuk. Makin besar makin banyak udara bisa lewat.' },
      { label: 'VE Maks', unit: 'x', desc: 'Efisiensi pengisian silinder (1.00 = penuh 100%). Standar ~0.90–0.95, mesin sudah "napas" luwes bisa 1.00+.' },
      { label: 'Ketinggian', unit: 'm', desc: 'Ketinggian lokasi di atas permukaan laut. Udara makin tinggi makin tipis (lebih sedikit oksigen) → map jadi lebih kurus karena model mengoreksi densitas.' },
      { label: 'Suhu Intake', unit: '°C', desc: 'Suhu udara yang masuk mesin (udara luar sekitar). Udara panas lebih encer → model mengoreksi densitas otomatis.' },
    ],
  },
  {
    title: 'Klep & Knalpot',
    items: [
      { label: 'Klep Intake', unit: 'mm', desc: 'Diameter daun klep hisap (pintu masuk udara).' },
      { label: 'Klep Exhaust', unit: 'mm', desc: 'Diameter daun klep buang (pintu keluar gas buang).' },
      { label: 'Header P1', unit: 'mm', desc: 'Ukuran pipa header pada ujung taper — berpengaruh pada posisi power band.' },
      { label: 'Inlet Knalpot', unit: 'mm', desc: 'Diameter lubang saluran masuk knalpot (tempat header menancap).' },
      { label: 'Outlet Knalpot', unit: 'mm', desc: 'Diameter lubang keluar knalpot (ujung belakang / standard megaphone).' },
    ],
  },
  {
    title: 'Bahan Bakar & Efisiensi',
    items: [
      { label: 'Oktan', unit: 'RON', desc: 'Angka oktan bensin yang dipakai (92 / 95 / 98). Dipakai untuk memilih timing api yang aman.' },
      { label: 'Efisiensi Termal', unit: '', desc: 'Seberapa efisien mesin mengubah energi bensin jadi tenaga. Mesin 4-tak racy ~0.30.' },
      { label: 'Offset Fase Injeksi', unit: '°', desc: 'Geseran acuan sudut Injector Timing bila hasil terasa bergeser dari referensi ECU. Untuk penyesuaian halus.' },
      { label: 'Offset Bacaan Ignition', unit: '°', desc: 'Penyesuaian nilai ignition agar nyambung dengan cara baca di device JUKEN-mu. Manual JUKEN memakai acuan +9° ketika membandingkan tabel.' },
    ],
  },
  {
    title: 'Grid Mapping',
    note: 'Membentuk kerangka tabel: dari RPM berapa mulai, sampai batasnya, dan selisih antar baris.',
    items: [
      { label: 'Idle RPM', unit: 'rpm', desc: 'Putaran idle mesin-mu (referensi, mis. 1600). Tabel selalu mulai 1000 sesuai format JUKEN — nilai ini tidak menggeser kolom grid.' },
      { label: 'Max RPM', unit: 'rpm', desc: 'Tinggi kolom tabel (format JUKEN mentok 16000 — sebaiknya jangan diubah, biar bentuk tabel cocok dengan JUKEN).' },
      { label: 'Limiter RPM', unit: 'rpm', desc: 'Batas putaran nyata dari ECU (limiter). Zona "WOT rpm tinggi" pada AFR dan titik power peak mengikuti angka ini, bukan Max RPM. 0 = ikut Max RPM.' },
      { label: 'Step RPM', unit: 'rpm', desc: 'Selisih antar baris RPM (mis. 250).' },
    ],
  },
  {
    title: 'Target AFR',
    note: 'AFR = perbandingan udara : bensin yang dibakar. Angka kecil = campuran "kaya" (bensin banyak), angka besar = "miskin" (irit, tapi rawan panas).',
    items: [
      { label: 'AFR Idle', unit: ':1', desc: 'Kondisi diam / stasioner. Acuan untuk cam besar/CR tinggi: 13.5–13.8.' },
      { label: 'AFR Cruising', unit: ':1', desc: 'Jalan santai, putaran stabil. Acuan untuk CR tinggi: 13.5–13.8.' },
      { label: 'AFR Akselerasi', unit: ':1', desc: 'Bukaan gas menengah / ngebut. Acuan: 13.0–13.5.' },
      { label: 'AFR WOT', unit: ':1', desc: 'Gas penuh, beban tinggi. Acuan: 12.5–13.0.' },
      { label: 'AFR WOT + RPM tinggi', unit: ':1', desc: 'Gas penuh pada putaran sangat tinggi (proteksi komponen). Acuan: 12.5–12.8.' },
    ],
  },
  {
    title: 'Kalibrasi AFR (tab Kalibrasi)',
    note: 'Cara paling efektif bikin mapping "pas" dengan motor-mu: pakai AFR meter / dyno, masukkan angka terukur, biarkan app menghitung koreksinya.',
    items: [
      { label: 'Tujuan', unit: '', desc: 'App menghitung Base Map berdasar target AFR dari spek. Kalau mesinmu ternyata lebih kurus/kaya dari target (dibaca AFR meter), koreksi dibuat di tab Kalibrasi.' },
      { label: 'Cara isi', unit: '', desc: 'Ketuk sel TPS×RPM yang mau dikalibrasi → isi AFR angka yang terbaca saat kondisi itu (mis. 13.8 saat gas penuh 8000 rpm). Ketuk label TPS untuk salin baris.' },
      { label: 'Apa yang dihitung', unit: '', desc: 'Koreksi fuel % = (AFR terukur / AFR target − 1) × 100. Kalau terukur 13.8 tapi target 12.6 → +9.5% bensin ditambah (AFR kurus).' },
      { label: 'Tombol "Terapkan ke Fuel"', unit: '', desc: 'Menulis hasil koreksi % ke tabel Fuel Correction untuk sel yang terukur saja. Sel lain tidak ikut berubah. Hasilnya bisa di-tune manual di tab Fuel Corr.' },
      { label: 'Undo', unit: '', desc: 'Setiap edit (Fuel, Base, Ignition, Inj. Timing, Kalibrasi) bisa dibatalkan dengan tombol Undo (riwayat 30 langkah terakhir).' },
    ],
  },
];

function Row({ item }: { item: GuideItem }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel}>{item.label}</Text>
        {item.unit ? <Text style={styles.rowUnit}>{item.unit}</Text> : null}
      </View>
      <Text style={styles.rowDesc}>{item.desc}</Text>
    </View>
  );
}

export default function GuideScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>Panduan Input</Text>
      <Text style={styles.heroSub}>
        Arti & fungsi tiap input di tab Setup — versi orang awam.
      </Text>

      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <View style={styles.groupBody}>
            {g.note ? <Text style={styles.note}>{g.note}</Text> : null}
            {g.items.map((it) => (
              <Row key={it.label} item={it} />
            ))}
          </View>
        </Section>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Semua hasil adalah estimasi berbasis spek. Kalibrasi akhir tetap dari dyno / AFR meter di lapangan.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  heroTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  heroSub: { color: Colors.textDim, fontSize: FontSize.md, marginTop: 2, marginBottom: Spacing.lg },
  groupBody: { width: '100%' },
  note: { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 17, marginBottom: Spacing.sm, fontStyle: 'italic' },
  row: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  rowLabel: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  rowUnit: { color: Colors.tabActive, fontSize: FontSize.sm, fontWeight: '700' },
  rowDesc: { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 17 },
  footer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
  },
  footerText: { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 17 },
});