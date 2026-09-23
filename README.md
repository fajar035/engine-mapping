# Engine Mapping — Siap Tempel ke JUKEN 5++

Aplikasi mobile (React Native / Expo) untuk membuat **mapping Base Map, Fuel Correction, Ignition Timing, dan Injector Timing** berbasis spek motor — dengan format tabel yang **sama persis dengan aplikasi JUKEN 5 Plus Plus** (Play Store) sehingga nilai bisa langsung disalin dan diisi ke app JUKEN.

Struktur tabel mengikuti aplikasi JUKEN 5 Plus Plus (desktop/programmer Android):
- **Baris = TPS (%) di kiri**: 0, 2, 5, 10, 15, 20, 25, … 100.
- **Kolom = RPM di atas**: mulai 1000, step 500, mentok **16000** (batas RPM bisa diubah user di tab Setup: Max RPM & Step RPM).
- Empat peta yang ditiru: **Base Map (ms)**, **Fuel Correction (%)**, **Ignition Timing (°BTDC)**, **Injector Timing (°)**.

Semua angka dihitung otomatis dari spek (noken, seher, injector, throttle body, dll), sehingga saat spek diganti baseline ikut menyesuaikan.

---

## Fitur

### 1. Setup & Spek Mesin
- Kapasitas mesin (cc) otomatis dari: bore, stroke, silinder, over size.
- Rasio kompresi & volume burni.
- Spek **noken as**: buka/tutup klep (IN °BTDC/°ABDC, EX °BBDC/°ATDC), lift intake/exhaust. Durasi & overlap otomatis (`durasi = buka + 180 + tutup`, `overlap = IN buka + EX tutup`).
- Spek **klep**: diameter intake/exhaust — untuk luas curtain & **flow ceiling** (batas power).
- Spek **knalpot** (drag pipe): header P1, inlet, outlet — menggeser posisi power band.
- Spek **injector**: flow (cc/min), jumlah, tekanan bensin, dead time, **injPhaseOffset** (geser referensi sudut bila nilai Injector Timing yang disalin dirasa bergeser dari referensi ECU).
- Spek **pasokan udara**: diameter throttle body (TB), VE maks.
- **Bahan bakar & efisiensi**: oktan (RON), efisiensi termal.
- **Grid mapping**: idle RPM, max RPM, step RPM (menjadi baris grid).

### 2. Analisa Mesin
- Kapasitas cc & volume burni; IVO/IVC/EVO/EVC & overlap.
- Estimasi torsi & power puncak (HP) + RPM-nya.
- Kecepatan piston  di RPM maks; kebutuhan flow injector vs terpasang + duty cycle; rasio TB vs bore.

### 3. Base Map (JUKEN) — *tab baru*
- Tabel RPM × TPS berisi **lama injeksi awal (ms)** — tabel pertukaran dengan "Base Map" JUKEN.
- Digenerate otomatis dari model airflow (VE, AFR target per TPS, spek injector). Tombol "Generate ulang dari spek".
- Setelah ini, Fuel Correction tinggal sebagai koreksi % terhadap base map ini.

### 4. Fuel Correction
- Tabel RPM × TPS berisi **koreksi fuel (%)** terhadap Base Map (positif = lebih kaya).
- Sub-sel menampilkan ms final (`Base Map × (1 + korreksi/100)`).
- Reset ke 0% (nilai-nol = murni mengikuti Base Map).

### 5. Ignition Timing
- Tabel RPM × TPS berisi **derajat pengapian sebelum TMA (°BTDC)**, resolusi 0.5°.
- Baseline otomatis memperhitungkan RPM, kompresi, oktan, overlap noken.
- Memperhatikan catatan manual JUKEN: nilai advance di program ditambah titik acuan 9°.

### 6. Injector Timing
- Tabel RPM × TPS berisi **sudut mulai injeksi (° putaran mesin, 0 = TMA ignisi)** — nilai yang sama dengan tabel "Injector Timing" JUKEN.
- Baseline: injeksi berakhir saat klep intake mulai buka (IVO). Durasi (derajat) diambil dari Base Map kolom yang sama (`derajat = ms × rpm × 0.006`).
- Sesuai karakter JUKEN: RPM makin tinggi nilainya menuju **0** (debit lebih besar).

### 7. Salin ke JUKEN 5++
- **Ketuk label TPS di sisi kiri tabel** → baris TPS itu disalin ke clipboard dalam format `RPM <tab> nilai` per baris (mudah diisi ke app JUKEN: "TPS 70% [IT]: 1000 RPM 188, …").
- **Tombol "Salin Semua"** → seluruh tabel disalin sebagai TSV (baris atas = RPM, kolom pertama = TPS) — tinggal tempel di spreadsheet/laptop.
- Berlaku di keempat peta. Data tersimpan otomatis (AsyncStorage), mode gelap, offline.

---

## Teknologi

| Komponen | Pilihan |
|---|---|
| Framework | Expo (React Native) + TypeScript |
| Versi SDK | Expo SDK 57 |
| Navigasi | React Navigation (bottom tabs) |
| Penyimpanan | AsyncStorage |
| Clipboard | expo-clipboard (copy per kolom) |
| Ikon | @expo/vector-icons (Ionicons) |

---

## Struktur Proyek

```
.
├── App.tsx                     # Entry: navigasi tab + provider state
├── app.json                    # Konfigurasi Expo (nama, package, tema)
├── eas.json                    # Profil build EAS (development/preview/production)
├── index.ts                    # Register app
└── src/
    ├── engine.ts               # Kalkulasi (cc, cam, VE, airflow, injector, ignition, base map)
    ├── engineState.tsx         # Context + persistensi AsyncStorage (storage key v3)
    ├── heat.ts                 # Skala warna panas untuk sel grid
    ├── theme.ts                # Warna & spacing
    ├── types.ts                # Tipe data + konstanta grid JUKEN (JUKEN_TPS, step 250)
    ├── copy.ts                 # Format & salin kolom ke clipboard
    ├── useCopy.ts              # Hook useCopy (status "Terkopi")
    ├── components/
    │   ├── CellEditModal.tsx   # Modal edit sel (input angka + +/-)
    │   ├── MapGrid.tsx         # Grid RPM × TPS (header TPS bisa diketuk untuk salin)
    │   ├── NumField.tsx        # Input angka
    │   ├── Section.tsx         # Kartu section form
    │   └── StatCard.tsx        # Kartu hasil perhitungan
    └── screens/
        ├── SetupScreen.tsx     # Input spek + analisa mesin
        ├── BaseMapScreen.tsx   # Base Map (ms)
        ├── FuelScreen.tsx      # Fuel Correction (%)
        ├── IgnitionScreen.tsx  # Ignition Timing (°BTDC)
        └── InjectorScreen.tsx  # Injector Timing (°)
```

---

## Cara Menjalankan Project

### Prasyarat
- Node.js (LTS), ponsel/emulator, akun Expo (untuk build EAS).

### 1. Install dependencies
```bash
npm install
```

### 2. Jalankan di mode development
```bash
npx expo start
```
- **HP**: scan QR dengan **Expo Go** (HP & laptop sejaringan).
- **Emulator**: tekan `a` (Android) / `i` (iOS).

### 3. Build APK
**Cara A — EAS (cloud, tanpa Android Studio):**
```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```
**Cara B — Lokal (butuh Android SDK + JDK):**
```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```
Hasil: `android/app/build/outputs/apk/release/app-release.apk`

---

## Rumus & Estimasi yang Dipakai

Semua hasil adalah **estimasi berbasis spek**, bukan angka absolut / dyno.

- **Kapasitas mesin**: `(π/4) × bore² × stroke × jumlah silinder`.
- **Event klep** (derajat crank): `durasi intake = IVO + 180 + IVC`, exhaust serupa, `overlap = IVO + EVC`.
- **Base Map (ms)**: fuel = airflow/VE ÷ AFR target per TPS, dibagi per siklus & injector → PW (`PW = fuel/siklus ÷ flow injection + dead time`).
- **Flow injector**: cc/min rating (pada 3.0 bar) dikoreksi tekanan: `flow aktual ≈ rating × √(tekanan/3)`.
- **Konversi derajat injeksi**: `derajat = ms × rpm × 0.006`.
- **Injector Timing**: `IT = (360 − EOI°BTDC) − durasiDerajat` (kerangka 0 = TMA ignisi); tumbuh mendekati 0 di RPM tinggi.
- **Flow ceiling klep**: `π × D_klep × lift` (curtain), power dijepit ke `curtain × 0.0263 HP/mm²`.
- **Pergeseran power band (knalpot)**: header P1 > ~0.58×bore menaikkan torsi puncak; outlet > P1 menambah efek top-end.
- **Ignition baseline**: kurva RPM + koreksi kompresi, oktan, overlap.

---

## Catatan Kalibrasi

- Tabel di sini adalah **titik awal**. Final kalibrasi tetap dari dyno / AFR meter.
- Saat menyalin ke JUKEN, sesuaikan angka dengan reaksi mesin; jika nilai Injector Timing terasa bergeser dari referensi ECU, geser `injPhaseOffset` di tab Setup lalu "Reset ke Baseline".
- Gunakan area yang aman untuk uji coba.

---

## Lint & Typecheck

```bash
npx tsc --noEmit       # typecheck
npx expo lint          # lint (ESLint)
npx expo-doctor        # cek konfigurasi dependency Expo
```