import { PermissionsAndroid, Platform } from 'react-native';
import { JukenError } from './errors';
import { LineFramer } from './protocol';

export interface Transport {
  readonly kind: 'bt' | 'wifi';
  readonly label: string;
  send(line: string): Promise<void>;
  /** Baris-baris yang sudah masuk, dipanggil tiap ada data baru. */
  onLines(handler: (lines: string[]) => void): () => void;
  disconnect(): Promise<void>;
}

export type { JukenErrorKind as TransportErrorKind } from './errors';
export { JukenError as TransportError } from './errors';

export interface BtDeviceInfo {
  address: string;
  name: string;
  bonded: boolean;
}

type BtModule = typeof import('react-native-bluetooth-classic').default;
type BtDevice = {
  address: string;
  name: string;
  bonded?: boolean;
  disconnect(): Promise<boolean>;
  write(data: string, encoding?: 'utf-8' | 'ascii'): Promise<boolean>;
  on(
    event: 'read',
    listener: (data: string, error?: Error) => void,
  ): { remove: () => void };
};

export function isBluetoothSupported(): boolean {
  return Platform.OS === 'android';
}

let btModule: BtModule | undefined;
function getBt(): BtModule {
  if (!isBluetoothSupported()) {
    throw new JukenError(
      'unsupported',
      'Bluetooth SPP hanya didukung di Android. Di iOS gunakan copy-paste manual.',
    );
  }
  if (btModule) return btModule;
  // Di-load dinamis supaya modul native tidak pecah saat bundle dimuat di iOS/web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: BtModule = require('react-native-bluetooth-classic').default;
  // `_nativeModule` null = modul native tidak ter-link di binary ini. Yang
  // konstruksinya `new BluetoothModule(NativeModules.RNBluetoothClassic)`, jadi
  // null berarti NativeModules-nya tidak ada: app jalan di Expo Go / build lama.
  if (!mod || !mod._nativeModule) {
    throw new JukenError(
      'unsupported',
      'Modul Bluetooth belum ter-link di binary ini. Jalankan ' +
        '`npx expo run:android` (build development). Expo Go tidak bisa — ' +
        'library ini punya kode native dan butuh rebuild.',
    );
  }
  btModule = mod;
  return mod;
}

export async function ensureBluetoothReady(): Promise<void> {
  const bt = getBt();
  if (!(await bt.isBluetoothAvailable())) {
    throw new JukenError(
      'unavailable',
      'Perangkat ini tidak punya Bluetooth.',
    );
  }
  if (!(await bt.isBluetoothEnabled())) {
    throw new JukenError(
      'notEnabled',
      'Bluetooth belum aktif. Nyalakan lewat Pengaturan HP lalu tekan Scan lagi.',
    );
  }
  await requestBluetoothPermissions();
}

/**
 * Android 12 (API 31)+) mengganti izin lokasi lama dengan BLUETOOTH_SCAN /
 * BLUETOOTH_CONNECT. Di bawah itu masih perlu ACCESS_FINE_LOCATION untuk
 * bisa melihat daftar device. Modul ini tidak mengekspos requestAdapterPermission,
 * jadi diminta lewat core React Native.
 */
async function requestBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
  const wanted =
    api >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const granted = await PermissionsAndroid.requestMultiple(wanted);
  const denied = Object.entries(granted).find(([, v]) => v !== 'granted');
  if (denied) {
    throw new JukenError(
      'permission',
      'Izin Bluetooth tidak diberikan. Aktifkan di Pengaturan aplikasi.',
    );
  }
}

/**
 * Scan streaming: perangkat yang sudah ter-pair langsung dikembalikan, lalu
 * yang baru ditemukan dikirim lewat callback selama discovery berjalan.
 * Mengembalikan fungsi berhenti — pemanggil WAJIB memanggilnya, kalau tidak
 * discovery akan tetap menyala dan membebani HP.
 */
export async function scanDevices(
  onFound: (device: BtDeviceInfo) => void,
): Promise<() => Promise<void>> {
  const bt = getBt();
  const seen = new Map<string, BtDeviceInfo>();
  const emit = (d: { address: string; name?: string | null; bonded?: unknown }) => {
    const info: BtDeviceInfo = {
      address: d.address,
      name: d.name ?? d.address,
      bonded: Boolean(d.bonded),
    };
    // Device yang sudah ter-pair tidak perlu diulang saat discovery jalan.
    if (seen.has(info.address) && seen.get(info.address)?.bonded) return;
    seen.set(info.address, info);
    onFound(info);
  };

  for (const d of await bt.getBondedDevices()) emit(d);

  const sub = bt.onDeviceDiscovered((event) => emit(event.device));
  try {
    await bt.startDiscovery();
  } catch {
    // Discovery ditolak (mis. sedang aktif) — device ter-pair tetap berguna.
  }

  return async () => {
    sub.remove();
    try {
      await bt.cancelDiscovery();
    } catch {
      // sudah berhenti — abaikan
    }
  };
}

/** Scan sekali tanpa streaming. */
export async function listDevices(): Promise<BtDeviceInfo[]> {
  const found: BtDeviceInfo[] = [];
  const stop = await scanDevices((d) => {
    if (!found.some((x) => x.address === d.address)) found.push(d);
  });
  await stop();
  return found.sort((a, b) => Number(b.bonded) - Number(a.bonded));
}

/**
 * Pairing dengan ECU. Android memunculkan dialog sistem (atau dialog PIN ECU),
 * jadi prosesnya bisa lama — timeout sengaja longgar.
 */
export async function pairDevice(address: string): Promise<void> {
  const bt = getBt();
  try {
    await bt.pairDevice(address);
  } catch (err) {
    throw new JukenError(
      'connectFailed',
      `Gagal pair dengan ${address}: ${describe(err)}. ` +
        'Buka Pengaturan Bluetooth, pair ECU dari sana, lalu coba lagi.',
    );
  }
}

/** Pair + langsung sambung — urutan yang benar untuk perangkat baru. */
export async function pairAndConnect(address: string): Promise<Transport> {
  await ensureBluetoothReady();
  await pairDevice(address);
  return BluetoothTransport.connect(address);
}

class BluetoothTransport implements Transport {
  readonly kind = 'bt' as const;
  readonly label: string;
  private framer = new LineFramer();
  private handlers = new Set<(lines: string[]) => void>();
  private subscription: { remove: () => void } | null = null;
  private dev: BtDevice | null = null;

  constructor(
    address: string,
    name: string,
    private device: BtDevice,
  ) {
    this.label = name ? `${name} (${address})` : address;
  }

  static async connect(address: string): Promise<BluetoothTransport> {
    const bt = getBt();
    let device: BtDevice;
    try {
      device = (await bt.connectToDevice(address)) as unknown as BtDevice;
    } catch (err) {
      throw new JukenError(
        'connectFailed',
        `Tidak bisa konek ke ${address}: ${describe(err)}. Pair dulu di Pengaturan Bluetooth.`,
      );
    }
    const t = new BluetoothTransport(address, device.name ?? '', device);
    t.subscription = device.on('read', (data: string, error?: Error) => {
      if (error) return;
      const lines = t.framer.push(data);
      if (lines.length) t.emit(lines);
    });
    return t;
  }

  private emit(lines: string[]) {
    for (const h of this.handlers) h(lines);
  }

  async send(line: string): Promise<void> {
    if (!this.dev) this.dev = this.device;
    if (!this.dev) throw new JukenError('io', 'Koneksi tidak aktif.');
    try {
      await this.dev.write(line, 'ascii');
    } catch {
      throw new JukenError('io', 'Gagal menulis ke ECU.');
    }
  }

  onLines(handler: (lines: string[]) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async disconnect(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;
    try {
      await this.device.disconnect();
    } catch {
      // ignore
    }
    this.dev = null;
  }
}

export async function connectBluetooth(
  address: string,
): Promise<Transport> {
  await ensureBluetoothReady();
  return BluetoothTransport.connect(address);
}
/** Ambil pesan asli dari error native agar pesan ke user tidak generik. */
function describe(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return 'kesalahan tidak diketahui';
}
