import * as Clipboard from 'expo-clipboard';

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
 * satu baris per TPS (urut 0,2,5…100 dari atas), nilai mentah per kolom RPM
 * dipisah TAB, tanpa judul/header. Contoh (61 nilai = RPM 1000…16000 step 250):
 *   3.22\t3.22\t3.22\t3.17\t…
 *   3.46\t3.46\t3.46\t3.45\t…
 */
export async function copyAll(
  rpms: number[],
  tps: readonly number[],
  valueAt: (r: number, c: number) => string,
): Promise<void> {
  const lines = tps.map((_, r) => rpms.map((_, c) => valueAt(r, c)).join('\t'));
  await Clipboard.setStringAsync(lines.join('\n'));
}