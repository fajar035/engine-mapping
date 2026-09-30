import {
  JUKEN_ROWS,
  MAP_COLS,
  RowCollector,
  type JukenMapKey,
  type ParsedRow,
  encodeDumpVariables,
  encodeExecute,
  encodeRowRead,
  encodeRowWrite,
} from './protocol';
import { JukenError } from './errors';
import type { Transport } from './transport';

export interface MapAddresses {
  baseMap: string;
  fuel: string;
  injectorTiming: string;
  ignition: string;
}

/**
 * Posisi variabel di dalam dump `1607` (1-indexed di ECU; di sini 0-indexed).
 * Dipertohkan dari urutan switch pada aplikasi BRT v2.2.0:
 *   25=b_c1 26=f_c1 27=it_c1 28=ig_c1 29=b_c2 30=f_c2 31=it_c2 32=ig_c2
 */
const ADDRESS_INDEX = {
  baseMap: 24,
  fuel: 25,
  injectorTiming: 26,
  ignition: 27,
} as const;

const DEFAULT_TIMEOUT = 4000;

interface Waiter {
  pred: (p: ParsedRow) => boolean;
  resolve: (p: ParsedRow) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface SessionOptions {
  timeoutMs?: number;
  onRaw?: (line: string) => void;
  onLog?: (msg: string) => void;
}

export class JukenSession {
  private waiters: Waiter[] = [];
  /** Token mentah yang belum diparse. */
  private pending: string[] = [];
  /** Hasil parse (ACK / baris lengkap) yang menunggu waiter. */
  private ready: ParsedRow[] = [];
  private unsubscribe: () => void;
  private closed = false;
  private collector = new RowCollector();

  constructor(
    private transport: Transport,
    private options: SessionOptions = {},
  ) {
    this.unsubscribe = transport.onLines((lines) => {
      for (const raw of lines) {
        this.options.onRaw?.(raw);
        this.pending.push(raw);
      }
      this.pump();
    });
  }

  get deviceLabel(): string {
    return this.transport.label;
  }

  private get timeout(): number {
    return this.options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  private pump() {
    // Token '9601'/'9602'/… memulai baris; angka berikutnya mengisi kolom
    // sampai jumlah kolom peta terpenuhi (lihat RowCollector). Hasilnya
    // ditumpuk di `ready` supaya waiter bisa finds walau data masuk duluan.
    while (this.pending.length) {
      const raw = this.pending.shift()!;
      try {
        const parsed = this.collector.push(raw);
        if (parsed) this.ready.push(parsed);
      } catch {
        // token rusak — abaikan, ECU sering mengirim sisa noise
      }
    }
    while (this.ready.length && this.waiters.length) {
      const parsed = this.ready.shift()!;
      const w = this.waiters.find((x) => x.pred(parsed));
      if (!w) continue;
      clearTimeout(w.timer);
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.resolve(parsed);
    }
  }

  /** Tunggu baris yang cocok dengan predicate, atau batal setelah timeout. */
  waitFor(
    pred: (p: ParsedRow) => boolean,
    timeoutMs = this.timeout,
    what = 'respons ECU',
  ): Promise<ParsedRow> {
    if (this.closed) {
      return Promise.reject(new JukenError('io', 'Sesi sudah ditutup.'));
    }
    // Events yang sudah diparse sebelum waiter ini dibuat tetap dipakai.
    const buffered = this.ready.findIndex((p) => pred(p));
    if (buffered >= 0) {
      const [hit] = this.ready.splice(buffered, 1);
      return Promise.resolve(hit);
    }
    return new Promise<ParsedRow>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((x) => x.timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(
          new JukenError(
            'io',
            `Timeout menunggu ${what}. ECU tidak menjawab dalam ${timeoutMs} ms.`,
          ),
        );
      }, timeoutMs);
      this.waiters.push({ pred, resolve, reject, timer });
    });
  }

  async send(line: string): Promise<void> {
    this.options.onLog?.(`TX ${line.replace(/\r\n$/, '').slice(0, 90)}`);
    await this.transport.send(line);
  }

  /** Buang sisa baris yang belum dikonsumsi — dipakai sebelum operasi baru. */
  flush() {
    this.pending.length = 0;
    this.ready.length = 0;
    this.collector.reset();
  }

  /**
   * Minta ECU menumpahkan variabel, lalu ambil alamat memori tiap peta.
   * Alamat wajib diketahui sebelum menulis; tanpa itu ECU tidak tahu peta mana
   * yang harus ditimpa.
   */
  async readAddresses(): Promise<{
    addresses: MapAddresses;
    all: string[];
  }> {
    this.flush();
    this.collector.reset();
    const values: string[] = [];
    const isValue = (p: ParsedRow) => p.kind === 'value';
    const deadline = Date.now() + this.timeout * 3;

    await this.send(encodeDumpVariables());
    // Kumpulkan nilai berurutan sampai ECU diam. Diam di sini normal, jadi
    // timeout diperlakukan sebagai akhir stream — bukan kegagalan.
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        const p = await this.waitFor(
          isValue,
          Math.min(700, remaining),
          'variabel',
        );
        if (p.kind === 'value') values.push((p as { value: string }).value);
      } catch {
        break;
      }
    }

    const pick = (map: JukenMapKey): string => {
      const v = values[ADDRESS_INDEX[map]];
      return v === undefined ? '' : v.trim();
    };

    const addresses: MapAddresses = {
      baseMap: pick('baseMap'),
      fuel: pick('fuel'),
      injectorTiming: pick('injectorTiming'),
      ignition: pick('ignition'),
    };

    for (const key of Object.keys(addresses) as JukenMapKey[]) {
      if (!/^\d+$/.test(addresses[key])) {
        throw new JukenError(
          'io',
          `Alamat memori ${MAP_LABEL[key]} tidak terbaca dari ECU (dapat "${
            addresses[key] || 'kosong'
          }"). Isi manual di bawah atau ulangi koneksi.`,
        );
      }
    }
    return { addresses, all: values };
  }

  /** Baca satu baris peta dari ECU. */
  async readRow(map: JukenMapKey, address: string, row: number): Promise<number[]> {
    this.flush();
    this.collector.reset();
    const cols = MAP_COLS[map];
    await this.send(encodeRowRead(map, address, row));
    const p = await this.waitFor(
      (x) => x.kind === 'data' && x.map === map && x.values.length >= cols,
      this.timeout,
      `baris ${row} ${MAP_LABEL[map]}`,
    );
    if (p.kind !== 'data') throw new JukenError('io', 'Respons tidak valid.');
    return p.values.slice(0, cols);
  }

  /** Baca seluruh peta (21 x 61). */
  async readMap(
    map: JukenMapKey,
    address: string,
    onProgress?: (row: number) => void,
  ): Promise<number[][]> {
    const out: number[][] = [];
    for (let r = 0; r < JUKEN_ROWS; r++) {
      out.push(await this.readRow(map, address, r));
      onProgress?.(r + 1);
    }
    return out;
  }

  /**
   * Tulis seluruh peta. ECUahlun streaming: setelah tiap baris diterima, ECU
   * membalas `1A00` yang memerintahkan kita mengirim baris berikutnya.
   */
  async writeMap(
    map: JukenMapKey,
    address: string,
    values: readonly (readonly number[])[],
    onProgress?: (row: number) => void,
  ): Promise<void> {
    const cols = MAP_COLS[map];
    for (let r = 0; r < JUKEN_ROWS; r++) {
      const row = values[r];
      if (!row || row.length !== cols) {
        throw new JukenError(
          'io',
          `Baris ${r} ${MAP_LABEL[map]} belum lengkap (${row?.length ?? 0}/${
            cols
          } kolom). Regenerasi peta dulu.`,
        );
      }
      await this.send(encodeRowWrite(map, address, r, row));
      await this.waitFor(
        (p) => p.kind === 'ack' || (p.kind === 'code' && p.code === '1A00'),
        this.timeout,
        `ACK baris ${r} ${MAP_LABEL[map]}`,
      );
      onProgress?.(r + 1);
    }
  }

  /** Perintahkan ECU menerapkan nilai yang baru ditulis. */
  async execute(): Promise<void> {
    this.flush();
    await this.send(encodeExecute());
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new JukenError('io', 'Sesi ditutup.'));
    }
    this.waiters = [];
    this.pending = [];
    this.ready = [];
    this.unsubscribe();
    await this.transport.disconnect();
  }
}

const MAP_LABEL: Record<JukenMapKey, string> = {
  baseMap: 'Base Map',
  fuel: 'Fuel Correction',
  injectorTiming: 'Injector Timing',
  ignition: 'Ignition Timing',
};