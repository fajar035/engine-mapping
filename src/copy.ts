import * as Clipboard from 'expo-clipboard';

/**
 * Jumlah kolom ECU per peta, dari analisis APK JUKEN 5+ v2.2.0:
 * loop `mod(alamat, 61)` untuk Base/Fuel/Injector, `mod(alamat, 31)` untuk
 * Ignition. Kalau kolom tidak sesuai, ECU mengabaikan sisa kolom sehingga
 * seluruh nilai bergeser — itu alasan timing tidak cocok saat di-paste.
 */
export const ECU_COLS = { ignition: 31, wide: 61 } as const;

/** Sumbu RPM ECU ignition: 1000..16000 step 500 (31 kolom). */
export const ECU_IGNITION_RPMS = Array.from(
  { length: ECU_COLS.ignition },
  (_, i) => 1000 + i * 500,
);

/** Salin satu baris TPS (nilai per RPM) — mudah diisi manual ke app JUKEN. */
export async function copyColumn(
  rpms: number[],
  tps: number,
  valueAt: (rpmIndex: number) => string,
): Promise<void> {
  const lines = [`TPS ${tps}%`];
  rpms.forEach((rpm, i) => {
    lines.push(`${rpm}\t${valueAt(i)}`);
  });
  await Clipboard.setStringAsync(lines.join('\n'));
}

/**
 * Salin seluruh tabel dengan format persis copy-all JUKEN 5++:
 * satu baris per TPS (urut 0,2,5…100 dari atas), nilai mentah per kolom ECU
 * dipisah TAB, tanpa judul/header.
 *
 * Peta dihitung pada step 250 (61 kolom), sedangkan ECU ignition hanya punya 31
 * kolom step 500. `valueAt(r, c)` di sini memakai indeks pada sumbu ECU yang
 * diminta (`ecuRpms`), jadi nilainya diinterpolasi ke step 500 sebelum ditulis.
 */
export async function copyAll(
  ecuRpms: readonly number[],
  tps: readonly number[],
  valueAt: (r: number, c: number) => string,
): Promise<void> {
  const lines = tps.map(
    (_, r) => ecuRpms.map((_, c) => valueAt(r, c)).join('\t'),
  );
  await Clipboard.setStringAsync(lines.join('\n'));
}