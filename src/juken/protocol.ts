/**
 * Protokol JUKEN 5+ (dihasilkan dari analisis APK BRT "JUKEN 5+" v2.2.0).
 *
 * Ringkas: ini BUKAN protokol binary. Semua perintah dan respons berupa teks
 * ASCII, dipisah tanda titik koma `;` dan diakhiri CRLF. Tidak ada checksum.
 *
 * Bentuk umum baris:
 *   <kode>[;<argumen>…]\r\n
 *
 * Peta ECU berukuran 21 baris TPS x 61 kolom RPM, sama persis dengan grid yang
 * dipakai aplikasi ini (TPS_STEPS x rpms).
 */

// Axis ECU didefinisikan sekali di types.ts — sumber kebenaran untuk engine,
// protokol, dan layar export.
import { JUKEN_RPM_START, JUKEN_RPM_STEP, JUKEN_TPS } from '../types';

export { JUKEN_TPS };

export const JUKEN_ROWS = JUKEN_TPS.length; // 21

/** Sumbu RPM ECU: 1000..16000 step 250 = 61 kolom. */
export const JUKEN_RPMS = Array.from({ length: 61 }, (_, i) =>
  JUKEN_RPM_START + i * JUKEN_RPM_STEP,
);

export const JUKEN_COLS = JUKEN_RPMS.length; // 61

/**
 * Kode 4 digit. Digit terakhir menentukan peta:
 *   1xxx read   2xxx write   9xxx respons data   5009 execute
 * sehingga read/write/respons untuk satu peta selalu berbagi 3 digit terakhir.
 */
export const MAP_IDS = {
  baseMap: { read: '1601', write: '2601', data: '9601' },
  fuel: { read: '1602', write: '2602', data: '9602' },
  injectorTiming: { read: '1603', write: '2603', data: '9603' },
  ignition: { read: '1605', write: '2605', data: '9605' },
} as const;

export type JukenMapKey = keyof typeof MAP_IDS;

/**
 * Jumlah kolom per peta, dibaca dari loop APK: `mod(alamat, 61)` untuk
 * Base/Fuel/Injector, `mod(alamat, 31)` untuk Ignition.
 */
export const MAP_COLS: Record<JukenMapKey, number> = {
  baseMap: 61,
  fuel: 61,
  injectorTiming: 61,
  ignition: 31,
};

/**
 * Sumbu RPM per peta di ECU. Base/Fuel/Injector step 250 (61 kolom); Ignition
 * step 500 (31 kolom) sampai 16000.
 */
export const MAP_RPMS: Record<JukenMapKey, readonly number[]> = {
  baseMap: JUKEN_RPMS,
  fuel: JUKEN_RPMS,
  injectorTiming: JUKEN_RPMS,
  ignition: Array.from({ length: 31 }, (_, i) => 1000 + i * 500),
};

/** Jumlah kolom ECU untuk peta tertentu. */
export function mapCols(map: JukenMapKey): number {
  return MAP_COLS[map];
}

/** Minta ECU menumpahkan seluruh variabel (mengisi alamat memori peta). */
export const CMD_DUMP_VARIABLES = '1607';
/** Minta ulang / ping ulang koneksi. */
export const CMD_RETRY = '1617';
/** Perintahkan ECU menerapkan nilai yang baru saja ditulis. */
export const CMD_EXECUTE = '5009';
/** Request satu baris peta: <kodeRead>;<alamat>;<idxBaris> */
export const CMD_ROW = '1614';

/** ACK ECU setelah menerima satu baris, menandakan lanjut ke baris berikutnya. */
export const ACK_ROW = '1A00';

export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';
/** Gateway default ECU pada mode WiFi. Protokolnya identik dengan SPP. */
export const WIFI_HOST = '192.168.2.6';
export const WIFI_PORT = 80;

export const MAP_LABELS: Record<JukenMapKey, string> = {
  baseMap: 'Base Map',
  fuel: 'Fuel Correction',
  injectorTiming: 'Injector Timing',
  ignition: 'Ignition Timing',
};

export function isJukenMapKey(v: string): v is JukenMapKey {
  return v in MAP_IDS;
}

/** Baris `\r\n`-terminated. */
export function encodeLine(parts: (string | number)[]): string {
  return `${parts.join(';')}\r\n`;
}

export function encodeRowWrite(
  map: JukenMapKey,
  memoryAddress: string,
  rowIndex: number,
  values: readonly number[],
): string {
  const cols = MAP_COLS[map];
  if (values.length !== cols) {
    throw new Error(`Baris ${map} harus ${cols} kolom, dapat ${values.length}`);
  }
  if (rowIndex < 0 || rowIndex >= JUKEN_ROWS) {
    throw new Error(`Baris di luar jangkauan: ${rowIndex}`);
  }
  return encodeLine([
    MAP_IDS[map].write,
    memoryAddress,
    rowIndex,
    ...values.map((v) => formatValue(v)),
  ]);
}

export function encodeRowRead(
  map: JukenMapKey,
  memoryAddress: string,
  rowIndex: number,
): string {
  return encodeLine([MAP_IDS[map].read, memoryAddress, rowIndex]);
}

export function encodeExecute(): string {
  return encodeLine([CMD_EXECUTE]);
}

export function encodeDumpVariables(): string {
  return encodeLine([CMD_DUMP_VARIABLES]);
}

/**
 * Desimal dengan titik, presisi 2 — ECU tidak menerima notasi eksponensial
 * (mis. 1.2E-5) maupun nilai kosong.
 */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) {
    throw new Error(`Nilai tidak valid: ${v}`);
  }
  return v.toFixed(2);
}

/**
 * Pemisah baris di sisi ECU adalah ';' atau '\n' (0x0A), bukan '\r' saja.
 * Data masuk lewat Bluetooth dalam potongan-potongan, jadi muat byte
 * terpisah lalu potong di setiap pembatas.
 */
export class LineFramer {
  private buf = '';

  push(chunk: string): string[] {
    this.buf += chunk.replace(/\r/g, '');
    const out: string[] = [];
    let idx: number;
    while ((idx = this.indexOfDelimiter(this.buf)) >= 0) {
      out.push(this.buf.slice(0, idx));
      this.buf = this.buf.slice(idx + 1);
    }
    return out;
  }

  flush(): string[] {
    const rest = this.buf.trim();
    this.buf = '';
    return rest ? [rest] : [];
  }

  private indexOfDelimiter(s: string): number {
    let semi = s.indexOf(';');
    let nl = s.indexOf('\n');
    if (semi < 0) return nl;
    if (nl < 0) return semi;
    return Math.min(semi, nl);
  }
}

export type ParsedRow =
  | { kind: 'ack' }
  | { kind: 'data'; map: JukenMapKey; values: number[] }
  | { kind: 'code'; code: string }
  | { kind: 'value'; value: string }
  | { kind: 'unknown'; raw: string };

/** Peta yang kodenya cocok dengan `code`. */
export function mapForCode(code: string): JukenMapKey | undefined {
  return (Object.keys(MAP_IDS) as JukenMapKey[]).find(
    (k) => MAP_IDS[k].data === code,
  );
}

/**
 * Kumpulkan token ECU menjadi baris peta.
 *
 * Penting: ECU tidak mengirim `9601;1.0;2.0;…` sebagai satu baris. Ia mengirim
 * kode `9601` dulu, lalu setiap nilai sebagai token terpisah (`;` atau newline
 * sebagai pembatas). Baris dianggap lengkap setelah jumlah kolom per peta
 * terkumpul — persis seperti `mod(alamat, N) == 0` di aplikasi aslinya.
 */
export class RowCollector {
  private map: JukenMapKey | null = null;
  private values: number[] = [];
  /** Baris yang sudah lengkap tapi belum dibaca, untuk mode address dump. */
  private last: ParsedRow | null = null;

  reset(): void {
    this.map = null;
    this.values = [];
  }

  /** Baris lengkap terakhir (dipakai `readAddresses`). */
  takeLast(): ParsedRow | null {
    const v = this.last;
    this.last = null;
    return v;
  }

  push(token: string): ParsedRow | null {
    const t = token.trim();
    if (!t) return null;
    if (t === ACK_ROW) return { kind: 'ack' };

    const code = mapForCode(t);
    if (code) {
      this.map = code;
      this.values = [];
      return null;
    }

    // Selagi menunggu nilai, angka apa pun adalah bagian baris berjalan.
    if (this.map) {
      const n = Number(t);
      if (!Number.isFinite(n)) {
        this.map = null;
        this.values = [];
        return { kind: 'unknown', raw: t };
      }
      this.values.push(n);
      if (this.values.length >= MAP_COLS[this.map]) {
        const done: ParsedRow = {
          kind: 'data',
          map: this.map,
          values: this.values,
        };
        this.map = null;
        this.values = [];
        this.last = done;
        return done;
      }
      return null;
    }

    if (/^\d{4}$/.test(t)) return { kind: 'code', code: t };
    if (Number.isFinite(Number(t))) return { kind: 'value', value: t };
    return { kind: 'unknown', raw: t };
  }
}

/**
 * Parse satu baris lengkap sekaligus (dipakai unit test & dump satu baris).
 * Untuk stream ECU sungguhan pakai `RowCollector`.
 */
export function parseLine(raw: string): ParsedRow {
  const parts = raw.trim().split(';');
  const c = new RowCollector();
  let out: ParsedRow | null = null;
  for (const p of parts) {
    const r = c.push(p);
    if (r) out = r;
  }
  if (!out && parts.length === 1) {
    return { kind: 'unknown', raw: raw.trim() };
  }
  return out ?? { kind: 'unknown', raw: raw.trim() };
}

/** Bandingkan peta hasil baca ECU dengan peta aplikasi. */
export function diffMaps(
  ecu: readonly (readonly number[])[],
  app: readonly (readonly number[])[],
  map: JukenMapKey = 'baseMap',
  tolerance = 0.01,
): { maxDelta: number; mismatches: number; firstMismatch?: string } {
  const cols = MAP_COLS[map];
  const rpms = MAP_RPMS[map];
  let maxDelta = 0;
  let mismatches = 0;
  let firstMismatch: string | undefined;
  for (let r = 0; r < JUKEN_ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      const a = ecu[r]?.[c];
      const b = app[r]?.[c];
      if (a === undefined || b === undefined) {
        mismatches++;
        firstMismatch ??= `baris ${r} kolom ${c}: data tidak lengkap`;
        continue;
      }
      const d = Math.abs(a - b);
      if (d > maxDelta) maxDelta = d;
      if (d > tolerance) {
        mismatches++;
        firstMismatch ??= `baris ${r} (TPS ${JUKEN_TPS[r]}%), kolom ${c} (${
          rpms[c]
        } rpm): ECU ${a} vs app ${b}`;
      }
    }
  }
  return { maxDelta, mismatches, firstMismatch };
}

/**
 * Samakan peta aplikasi ke grid ECU.
 *
 * Peta dihitung pada step 250 rpm (61 kolom) sementara ECU ignition hanya
 * menerima 31 kolom step 500. Jadi kolom ECU diambil dari peta aplikasi lewat
 * interpolasi linear pada rpm yang sama — bukan ambil kolom kelipatan buta,
 * yang akan menggeser nilainya.
 */
export function toEcuGrid(
  map: JukenMapKey,
  app: readonly (readonly number[])[],
  appRpms: readonly number[],
): number[][] {
  const target = MAP_RPMS[map];
  const cols = MAP_COLS[map];
  if (app.length < JUKEN_ROWS) {
    throw new Error(
      `Peta ${map} harus ${JUKEN_ROWS} baris, dapat ${app.length}`,
    );
  }
  const out: number[][] = [];
  for (let r = 0; r < JUKEN_ROWS; r++) {
    const row = app[r];
    if (row.length < 2) {
      throw new Error(`Baris ${r} peta ${map} tidak punya kolom rpm cukup`);
    }
    const line: number[] = [];
    for (let c = 0; c < cols; c++) {
      line.push(sampleAtRpms(row, appRpms, target[c]));
    }
    out.push(line);
  }
  return out;
}

/** Interpolasi linear baris peta pada `rpm`. */
function sampleAtRpms(
  row: readonly number[],
  axis: readonly number[],
  rpm: number,
): number {
  const first = axis[0];
  const last = axis[axis.length - 1];
  if (rpm <= first) return row[0];
  if (rpm >= last) return row[row.length - 1];
  for (let i = 0; i < axis.length - 1; i++) {
    const a = axis[i];
    const b = axis[i + 1];
    if (rpm >= a && rpm <= b) {
      const span = b - a;
      if (span === 0) return row[i];
      const t = (rpm - a) / span;
      return row[i] + (row[i + 1] - row[i]) * t;
    }
  }
  return row[row.length - 1];
}
