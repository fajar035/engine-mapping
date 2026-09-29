// Format tabel JUKEN 5++: TPS dalam %, resolusi 5% dimulai 0-2-5-10..., RPM mulai 1000 step 250.
// CATATAN: JUKEN 5++ batas atas TPS 90% lalu langsung 100% — TPS 95% TIDAK ada di app JUKEN.
// Kalau grid ini menyertakan 95%, nilai baris 90–100 bergeser 1 tingkat saat di-paste ke JUKEN.
export const JUKEN_RPM_START = 1000;
export const JUKEN_RPM_STEP = 250;
export const JUKEN_TPS = [
  0, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100,
] as const;
export const TPS_STEPS = JUKEN_TPS;

/**
 * Tipe/arsitektur mesin.
 *
 * CATATAN: field ini HANYA dipakai modul suara idle (src/idleSound.ts).
 * Sengaja TIDAK ikut masuk ke perhitungan VE, timing ignition, torsi, atau
 * pulse width — kalibrasi base map dikunci ke data lapangan motor acuan dan
 * tidak boleh bergeser karena label tipe mesin diganti.
 */
export type EngineType =
  | 'single4'
  | 'bigsingle'
  | 'single2'
  | 'parallel2'
  | 'vtwin'
  | 'bigtwin'
  | 'inline3'
  | 'inline4'
  | 'inline6'
  | 'boxer'
  | 'rotary2'
  | 'rotary3'
  | 'diesel4';

export interface EngineTypeInfo {
  id: EngineType;
  label: string;
  desc: string;
  group: 'Streer' | 'Kembar' | 'Wankel' | 'Khas';
  /** Jumlah silinder yang wajar untuk tipe ini (rotary = jumlah rotor). */
  cyl: number;
  /** 2-tak atau 4-tak; 0 untuk rotary (Wankel bukan reciprokating). */
  strokes: 0 | 2 | 4;
}

export const ENGINE_TYPES: readonly EngineTypeInfo[] = [
  {
    id: 'single4',
    label: 'Single 4-Tak',
    desc: 'Satu silinder 4-tak, harian. Denyaran berat dengan jeda jelas.',
    group: 'Streer',
    cyl: 1,
    strokes: 4,
  },
  {
    id: 'bigsingle',
    label: 'Big Single Rumble',
    desc: 'Single besar bertenaga: low-end panjang dan getaran knalpot.',
    group: 'Streer',
    cyl: 1,
    strokes: 4,
  },
  {
    id: 'single2',
    label: 'Single 2-Tak',
    desc: 'Knalpot 2-tak: pop pendek dan kering karena scavenging.',
    group: 'Streer',
    cyl: 1,
    strokes: 2,
  },
  {
    id: 'parallel2',
    label: 'Parallel Twin',
    desc: 'Dua silinder sejajar (skuter 150): dua denyar bergantian.',
    group: 'Kembar',
    cyl: 2,
    strokes: 4,
  },
  {
    id: 'vtwin',
    label: 'V-Twin',
    desc: 'Dua silinder V: suara berat bergema, denyaran tidak rata.',
    group: 'Kembar',
    cyl: 2,
    strokes: 4,
  },
  {
    id: 'bigtwin',
    label: 'Big Twin',
    desc: 'V-twin besar: denyaran dalam, lope saat overlap tinggi.',
    group: 'Kembar',
    cyl: 2,
    strokes: 4,
  },
  {
    id: 'inline3',
    label: 'Inline-3',
    desc: 'Tiga silinder sebaris: pola denyaran unik, jalan tetap rata.',
    group: 'Kembar',
    cyl: 3,
    strokes: 4,
  },
  {
    id: 'inline4',
    label: 'Inline-4',
    desc: 'Empat silinder sebaris: paling halus, denyar tersebar merata.',
    group: 'Kembar',
    cyl: 4,
    strokes: 4,
  },
  {
    id: 'inline6',
    label: 'Inline-6',
    desc: 'Enam silinder: halus total, denyaran sangat rapat.',
    group: 'Kembar',
    cyl: 6,
    strokes: 4,
  },
  {
    id: 'boxer',
    label: 'Boxer / Flat',
    desc: 'Silinder mendatar: bunyi beriak khas, knalpot keluar dua sisi.',
    group: 'Khas',
    cyl: 2,
    strokes: 4,
  },
  {
    id: 'rotary2',
    label: 'Rotary 2 Rotor',
    desc: 'Wankel dua rotor: nada rotor melengking tinggi plus pop off-bomb.',
    group: 'Wankel',
    cyl: 2,
    strokes: 0,
  },
  {
    id: 'rotary3',
    label: 'Rotary 3 Rotor',
    desc: 'Wankel tiga rotor: lengking lebih tinggi dan lebih rapat.',
    group: 'Wankel',
    cyl: 3,
    strokes: 0,
  },
  {
    id: 'diesel4',
    label: 'Diesel 4-Sil',
    desc: 'Diesel common-rail: detak metalik keras, tanpa pop knalpot.',
    group: 'Khas',
    cyl: 4,
    strokes: 4,
  },
];

export const DEFAULT_ENGINE_TYPE: EngineType = 'single4';

export function findEngineType(id: string): EngineTypeInfo {
  return ENGINE_TYPES.find((t) => t.id === id) ?? ENGINE_TYPES[0];
}

export interface EngineSpec {
  name: string;

  // Mesin
  boreMM: number;
  strokeMM: number;
  cylinders: number;
  /** HANYA untuk simulasi suara idle — tidak memengaruhi VE/ignition/torsi. */
  engineType: EngineType;

  oversizeMM: number;
  compressionRatio: number;

  // Noken As (event buka/tutup klep dalam derajat crank)
  intakeIVO: number; // IN buka: ° sebelum TMA (BTDC)
  intakeIVC: number; // IN tutup: ° sesudah TMB (ABDC)
  exhaustEVO: number; // EX buka: ° sebelum TMB (BBDC)
  exhaustEVC: number; // EX tutup: ° sesudah TMA (ATDC)

  // Injector
  injectorFlowCC: number;
  injectorCount: number;
  fuelPressureBar: number;
  injectorDeadTime: number;

  // Pasokan udara
  veMax: number;
  altitudeM: number; // ketinggian lokasi (m) utk koreksi densitas udara
  airTempC: number; // suhu udara intake/lingkungan (°C)

  // Knalpot (drag pipe / megaphone)
  exhaustP1MM: number; // ukuran header P1 (ujung taper, mis. 30-34-38 -> 38)
  exhaustOutletMM: number; // outlet seher/stop

  // Bahan bakar & pembacaan ECU
  octane: number;
  injPhaseOffset: number;
  ignBaseOffset: number; // offset bacaan ignition thd acuan JUKEN (manual JUKEN: +9°)

  // Target AFR per kondisi (diisi user; 0 = kosong)
  afrIdle: number; // idle
  afrCruise: number; // jalan santai / cruising
  afrAccel: number; // bukaan menengah / akselerasi
  afrWot: number; // WOT / beban tinggi
  afrWotHigh: number; // WOT + rpm tinggi

  // Grid mapping
  maxRPM: number; // tinggi kolom tabel JUKEN (batas tabel, contoh 16000)
  limiterRPM: number; // batas putaran nyata ECU/limiter mesin (0 = pakai maxRPM)
  rpmStep: number;
}

export type SetupKey = 'motor' | 'umum';

export type Map2D = number[][];

export interface CamEvents {
  ivo: number;
  ivc: number;
  evo: number;
  evc: number;
  overlap: number;
  ic: number;
  ec: number;
}

export interface EngineStats {
  boreRealMM: number;
  sweptCC: number;
  clearanceCC: number;
  cam: CamEvents;
  torquePeakRPM: number;
  maxPistonSpeed: number;
  injRequiredCC: number;
  injRequiredPer: number;
  injInstalledCC: number;
  dutyAtPeak: number;
  dutyAtLimiter: number;
  headerVsBore: number;
}

export interface MapMeta {
  label: string;
  unit: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  baseLabel: (s: EngineSpec, rpm: number, tps: number) => string;
}
