// Format tabel JUKEN 5++: TPS dalam %, resolusi 5% dimulai 0-2-5-10..., RPM mulai 1000 step 250.
// CATATAN: JUKEN 5++ batas atas TPS 90% lalu langsung 100% — TPS 95% TIDAK ada di app JUKEN.
// Kalau grid ini menyertakan 95%, nilai baris 90–100 bergeser 1 tingkat saat di-paste ke JUKEN.
export const JUKEN_RPM_START = 1000;
export const JUKEN_RPM_STEP = 250;
export const JUKEN_TPS = [
  0, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100,
] as const;
export const TPS_STEPS = JUKEN_TPS;

export interface EngineSpec {
  name: string;

  // Mesin
  boreMM: number;
  strokeMM: number;
  cylinders: number;
  oversizeMM: number;
  compressionRatio: number;

  // Noken As (event buka/tutup klep dalam derajat crank)
  intakeIVO: number; // IN buka: ° sebelum TMA (BTDC)
  intakeIVC: number; // IN tutup: ° sesudah TMB (ABDC)
  exhaustEVO: number; // EX buka: ° sebelum TMB (BBDC)
  exhaustEVC: number; // EX tutup: ° sesudah TMA (ATDC)
  intakeLift: number;
  exhaustLift: number;

  // Injector
  injectorFlowCC: number;
  injectorCount: number;
  fuelPressureBar: number;
  injectorDeadTime: number;

  // Pasokan udara
  throttleBodyMM: number;
  veMax: number;

  // Klep
  valveIntakeMM: number;
  valveExhaustMM: number;

  // Knalpot (drag pipe / megaphone)
  exhaustP1MM: number; // ukuran header P1 (ujung taper, mis. 30-34-38 -> 38)
  exhaustInletMM: number; // inlet seher/stop
  exhaustOutletMM: number; // outlet seher/stop

  // Bahan bakar & efisiensi
  octane: number;
  thermalEff: number;
  injPhaseOffset: number;

  // Target AFR per kondisi (diisi user; 0 = kosong)
  afrIdle: number; // idle
  afrCruise: number; // jalan santai / cruising
  afrAccel: number; // bukaan menengah / akselerasi
  afrWot: number; // WOT / beban tinggi
  afrWotHigh: number; // WOT + rpm tinggi

  // Grid mapping
  idleRPM: number;
  maxRPM: number;
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
  powerPeakRPM: number;
  powerPeakHP: number;
  maxPistonSpeed: number;
  injRequiredCC: number;
  injRequiredPer: number;
  injInstalledCC: number;
  dutyAtPeak: number;
  tbsqToBoreRatio: number;
  valveInRatio: number;
  valveExRatio: number;
  curtainInMM2: number;
  flowCeilingHP: number;
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