# Engine Mapping — Siap Tempel ke JUKEN 5++

Aplikasi mobile (React Native / Expo) untuk membuat **mapping Base Map, Fuel Correction, Ignition Timing, dan Injector Timing** berbasis spek motor — dengan format tabel yang **sama persis dengan aplikasi JUKEN 5 Plus Plus** (Play Store) sehingga nilai bisa langsung disalin dan diisi ke app JUKEN.

Struktur tabel mengikuti aplikasi JUKEN 5 Plus Plus (desktop/programmer Android):
- **Baris = TPS (%) di kiri**: 0, 2, 5, 10, 15, 20, 25, … 90, 100 (**21 baris — TPS 95% tidak ada di JUKEN 5++**).
- **Kolom = RPM di atas**: mulai 1000, step 250, mentok **16000** (batas RPM bisa diubah user di tab Setup: Max RPM & Step RPM).
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

## Penjelasan Setiap Input (Tab Setup)

Semua angka dimasukkan lewat tab **Setup**. Penjelasan tiap input diurutkan per kartu/section yang tampil di layar.

### Analisa Mesin (hasil hitung, bukan input)
Otomatis dihitung dari spek yang diisi — lihat daftar nilai di bawah tiap input di poin berikut.

### Noken As & Klep
| Input | Satuan | Artinya |
|---|---|---|
| **IN Buka** | ° BTDC | Kapan klep hisap mulai membuka, sebelum piston di titik mati atas (TMA). |
| **IN Tutup** | ° ABDC | Kapan klep hisap menutup, setelah piston melewati titik mati bawah (TMB). |
| **EX Buka** | ° BBDC | Kapan klep buang mulai membuka, sebelum piston mencapai TMB. |
| **EX Tutup** | ° ATDC | Kapan klep buang menutup, setelah piston melewati TMA. |
| **Lift Intake** | mm | Tinggi angkat maksimum klep hisap (tebal "buka"-nya noken as). |
| **Lift Exhaust** | mm | Tinggi angkat maksimum klep buang. |

> Durasi & overlap dihitung otomatis: `durasi = buka + 180 + tutup`, `overlap = IN buka + EX tutup`. Ini yang menentukan karakter tenaga (top/bottom).

### Mesin
| Input | Satuan | Artinya |
|---|---|---|
| **Bore** | mm | Diameter lubang silinder (garis tengah piston). |
| **Stroke** | mm | Jarak tempuh piston dari titik mati atas ke bawah. |
| **Over Size** | mm | Tambahan diameter dari oversize piston (mis. 0.25/0.50). Real bore = bore + oversize. |
| **Silinder** | bh | Jumlah silinder (motor standar = 1). |
| **Rasio Kompresi** | :1 | Perbandingan volume silinder dgn ruang bakar (mis. 11:1). |

### Injector & TB
| Input | Satuan | Artinya |
|---|---|---|
| **Flow Injektor** | cc/min | Kapasitas semprotan injektor per menit (angka di badan injektor, biasanya @ 3 bar). |
| **Jumlah** | bh | Banyaknya injektor terpasang (motor umumnya 1). |
| **Tekanan Bensin** | bar | Tekanan bahan bakar di jalur injektor (cek regulator/pompa). |
| **Dead Time** | ms | Selisih waktu antara injektor "diperintah nyala" sampai bensin benar-benar keluar. |
| **Diameter TB** | mm | Diameter lubang throttle body (body kolter) — pintu masuk udara. |
| **VE Maks** | x | Efisiensi pengisian silinder maksimum (1.00 = 100%, mesin standar ~0.85–0.95, balap >1). |

### Klep & Knalpot
| Input | Satuan | Artinya |
|---|---|---|
| **Klep Intake** | mm | Diameter daun klep hisap. |
| **Klep Exhaust** | mm | Diameter daun klep buang. |
| **Header P1** | mm | Ukuran pipa header terlihat (ujung taper) — untuk hitung power band. |
| **Inlet Knalpot** | mm | Diameter saluran masuk knalpot (ujung header masuk knalpot). |
| **Outlet Knalpot** | mm | Diameter saluran keluar knalpot (ujung belakang). |

### Bahan Bakar & Efisiensi
| Input | Satuan | Artinya |
|---|---|---|
| **Oktan** | RON | Angka oktan bahan bakar yang dipakai (92/95/98). |
| **Efisiensi Termal** | (0–1) | Seberapa efisien mesin mengubah bahan bakar jadi tenaga (~0.30 utk mesin 4-tak racy). |
| **Offset Fase Injeksi** | ° | Geser acuan sudut Injector Timing bila hasil berasa bergeser dari referensi ECU. |

### Grid Mapping
| Input | Satuan | Artinya |
|---|---|---|
| **Idle RPM** | rpm | Putaran idle (stasioner) — titik awal baris tabel. |
| **Max RPM** | rpm | Batas putaran maksimum — baris terakhir tabel. |
| **Step RPM** | rpm | Selisih antar baris RPM (mis. 250). |

### Target AFR (per kondisi)
AFR = perbandingan udara : bensin yang terbakar (air fuel ratio). Semakin kecil angkanya, semakin kaya (bensin lebih banyak).
| Input | Acuan 4-tak | Artinya |
|---|---|---|
| **AFR Idle** | 13.8–14.7 | Kondisi stasioner / diam. |
| **AFR Cruising** | 14.0–14.7 | Jalan santai, putaran stabil. |
| **AFR Akselerasi** | 13.0–13.5 | Bukaan gas menengah / ngebut. |
| **AFR WOT** | 12.5–13.0 | Gas penuh (WOT) beban tinggi. |
| **AFR WOT+RPM tinggi** | 12.5–12.8 | Gas penuh pada rpm tinggi (proteksi mesin). |

> Nilai 0 = kosong/belum diisi → fallback ke acuan umum. Setelah mengubah AFR, tekan **«Generate ulang»** di tab Base Map.

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