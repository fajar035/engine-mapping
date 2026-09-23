import type { CamEvents, EngineSpec, EngineStats } from "./types";
import { JUKEN_RPM_START } from "./types";

export const AIR_DENSITY_G_L = 1.184; // udara 20°C, 1 atm
export const FUEL_DENSITY_G_CC = 0.75; // bensin
export const FUEL_ENERGY_MJ_KG = 43.5;
// Cadangan bila field AFR user masih 0 (kosong)
export const AFR_IDLE = 14.6;
export const AFR_WOT = 12.4;
export const MAX_DUTY = 0.85;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);
const round1 = (v: number) => Math.round(v * 10) / 10;
export const round2 = (v: number) => Math.round(v * 100) / 100;

export function defaultSpec(): EngineSpec {
  return {
    name: "vario 125 Led New · 63mm",
    // Mesin
    boreMM: 63,
    strokeMM: 57.9,
    cylinders: 1,
    oversizeMM: 0,
    compressionRatio: 12.8,

    // Noken As (event klep, derajat crank)
    intakeIVO: 29, // IN buka °BTDC
    intakeIVC: 53, // IN tutup °ABDC
    exhaustEVO: 57, // EX buka °BBDC
    exhaustEVC: 27, // EX tutup °ATDC
    intakeLift: 8.8,
    exhaustLift: 9.1,

    // Injector
    injectorFlowCC: 200,
    injectorCount: 1,
    fuelPressureBar: 3,
    injectorDeadTime: 0.65,

    // Pasokan udara
    throttleBodyMM: 32,
    veMax: 0.98,

    // Klep
    valveIntakeMM: 30,
    valveExhaustMM: 25,

    // Knalpot (drag pipe)
    exhaustP1MM: 30,
    exhaustInletMM: 38,
    exhaustOutletMM: 45,

    // Bahan bakar & efisiensi
    octane: 98,
    thermalEff: 0.3,
    injPhaseOffset: 0,

    // Target AFR per kondisi (default setup Motor Gw — bore-up/drag, CR 12.8, oktan 98:
    // sedikit lebih kaya dari standard tune biar aman dari detonasi/hot, idle lebih kaya
    // karena overlap cam besar bikin vacuum idle rendah)
    afrIdle: 13.8, // idle (cam besar: 13.5–13.8; huruf lembut standar 13.8–14.7)
    afrCruise: 13.8, // jalan santai (CR tinggi: 13.5–14.0)
    afrAccel: 13.0, // bukaan menengah (12.8–13.2)
    afrWot: 12.6, // WOT / beban tinggi (bore-up drag: 12.4–12.8)
    afrWotHigh: 12.4, // WOT + rpm tinggi (lebih kaya utk dinginkan, 12.2–12.5)

    // Grid mapping (format JUKEN: awal 1000, step 250, mentok 16000 = 61 titik — bisa diubah user)
    idleRPM: 1000,
    maxRPM: 16000,
    rpmStep: 250,
  };
}

// Setup Umum: semua value 0 (kosong) — user mengisi sendiri.
// Grid mapping tetap dipakai sebagai kerangka agar tabel tetap tergambar sebelum diisi.
export function emptySpec(): EngineSpec {
  return {
    name: "Setup Umum",
    boreMM: 0,
    strokeMM: 0,
    cylinders: 1,
    oversizeMM: 0,
    compressionRatio: 0,
    intakeIVO: 0,
    intakeIVC: 0,
    exhaustEVO: 0,
    exhaustEVC: 0,
    intakeLift: 0,
    exhaustLift: 0,
    injectorFlowCC: 0,
    injectorCount: 1,
    fuelPressureBar: 0,
    injectorDeadTime: 0,
    throttleBodyMM: 0,
    veMax: 0,
    valveIntakeMM: 0,
    valveExhaustMM: 0,
    exhaustP1MM: 0,
    exhaustInletMM: 0,
    exhaustOutletMM: 0,
    octane: 0,
    thermalEff: 0,
    injPhaseOffset: 0,
    afrIdle: 0,
    afrCruise: 0,
    afrAccel: 0,
    afrWot: 0,
    afrWotHigh: 0,
    idleRPM: 1000,
    maxRPM: 16000,
    rpmStep: 250,
  };
}

export function boreRealMM(s: EngineSpec): number {
  return s.boreMM + s.oversizeMM;
}

export function sweptCC(s: EngineSpec): number {
  const b = boreRealMM(s) / 10;
  const st = s.strokeMM / 10;
  const one = (Math.PI / 4) * b * b * st;
  return one * s.cylinders;
}

export function camEvents(s: EngineSpec): CamEvents {
  // Durasi = buka + 180 + tutup. Lobe center dihitung sebagai referensi.
  const dIn = s.intakeIVO + 180 + s.intakeIVC;
  const dEx = s.exhaustEVO + 180 + s.exhaustEVC;
  const ivo = Math.max(s.intakeIVO, 0);
  const ivc = Math.max(s.intakeIVC, 0);
  const evo = Math.max(s.exhaustEVO, 0);
  const evc = Math.max(s.exhaustEVC, 0);
  const ic = dIn / 2 - ivo; // intake centerline °ATDC
  const ec = dEx / 2 - evo; // exhaust centerline °BTDC
  return { ivo, ivc, evo, evc, overlap: ivo + evc, ic, ec };
}

export function intakeDuration(s: EngineSpec): number {
  return s.intakeIVO + 180 + s.intakeIVC;
}

export function exhaustDuration(s: EngineSpec): number {
  return s.exhaustEVO + 180 + s.exhaustEVC;
}

// Estimasi titik torsi puncak dari durasi noken, knalpot & max RPM mesin
export function torquePeakRPM(s: EngineSpec): number {
  const max = Math.max(s.maxRPM, 4000);
  const factor = 0.5 + (intakeDuration(s) - 200) * 0.0025; // 200° -> 0.5, 300° -> 0.75
  // Knalpot header lebih besar dari ~0.58×bore -> powerband naik (top-end)
  const headerShift =
    (s.exhaustP1MM - 0.58 * boreRealMM(s)) * 0.012 +
    (s.exhaustOutletMM - s.exhaustP1MM) * 0.003; // megaphone taper
  return clamp(
    Math.round(max * clamp(factor, 0.45, 0.85) * (1 + headerShift)),
    2000,
    max,
  );
}

export function powerPeakRPM(s: EngineSpec): number {
  const max = Math.max(s.maxRPM, 4000);
  return clamp(Math.round(torquePeakRPM(s) * 1.18), 2000, max);
}

// VE model: naik linier menuju torsi puncak, lalu menurun lembut di high rev
export function veAt(s: EngineSpec, rpm: number): number {
  const peak = torquePeakRPM(s);
  const base = Math.max(s.veMax - 0.42, 0.4);
  const amp = s.veMax - base;
  let ve: number;
  if (rpm <= peak) {
    ve = base + amp * Math.min((rpm - 1000) / (peak - 1000), 1);
  } else {
    ve = s.veMax - amp * Math.min((rpm - peak) / peak, 1);
  }
  return clamp(ve, 0.42, s.veMax + 0.03);
}

// Aliran udara (g/s) untuk seluruh silinder — natural (WOT, VE penuh)
export function airflowGS(s: EngineSpec, rpm: number): number {
  return veAt(s, rpm) * (sweptCC(s) / 1000) * AIR_DENSITY_G_L * (rpm / 120);
}

// Bukaan efektif throttle (0..1): butterfly cenderung non-linear, dipakai
// untuk membatasi aliran saat TPS rendah → aliran menjadi ~konstan (g/s)
// sehingga PW menurun seiring RPM — persis bentuk tabel JUKEN.
// Bundaran 0.03 = aliran idle minimum yang masih lewat (butterfly menyinggung
// idle air breather), agar baris TPS 0% tidak nol total.
function throttleArea(tpsPct: number): number {
  return 0.03 + 0.97 * Math.pow(clamp(tpsPct, 0, 100) / 100, 0.85);
}

// Aliran udara efektif pada bukaan throttle tertentu (g/s).
// Di bawah kapasitas plat: mengikuti VE natural; jika TPS rendah & RPM tinggi,
// throttle jadi pembatas → aliran ~konstan.
export function airflowAt(s: EngineSpec, rpm: number, tpsPct: number): number {
  const natural = airflowGS(s, rpm);
  const cap = airflowGS(s, s.maxRPM) * 1.25; // headroom supaya WOT tidak terpotong
  return Math.min(natural, cap * throttleArea(tpsPct));
}

export function pistonSpeedMs(s: EngineSpec, rpm: number): number {
  return (2 * (s.strokeMM / 1000) * rpm) / 60;
}

// Threshold zona TPS untuk target AFR (% bukaan)
const TPS_IDLE = 5; // di bawah ini = idle
const TPS_CRUISE = 25; // cruising / jalan santai
const TPS_ACCEL = 60; // bukaan menengah
const WOT_HI_RPM = 0.85; // 85% maxRPM = zona rpm tinggi

// Target AFR dinamis: ${tps}% bukaan → ${rpm} RPM.
// Memakai 5 nilai AFR dari setup; fallback ke konstanta bila field masih 0 (kosong).
export function afrFor(s: EngineSpec, rpm: number, tpsPct: number): number {
  const idle = s.afrIdle || AFR_IDLE;
  const cruise = s.afrCruise || AFR_IDLE;
  const accel = s.afrAccel || AFR_WOT + 0.6;
  const wot = s.afrWot || AFR_WOT;
  const wotHigh = s.afrWotHigh || AFR_WOT;

  // Zona TPS: idle → cruise → accel → wot
  let afr: number;
  if (tpsPct <= TPS_IDLE) {
    afr = idle;
  } else if (tpsPct <= TPS_CRUISE) {
    const k = (tpsPct - TPS_IDLE) / (TPS_CRUISE - TPS_IDLE);
    afr = idle + (cruise - idle) * k;
  } else if (tpsPct <= TPS_ACCEL) {
    const k = (tpsPct - TPS_CRUISE) / (TPS_ACCEL - TPS_CRUISE);
    afr = cruise + (accel - cruise) * k;
  } else {
    const k = (tpsPct - TPS_ACCEL) / (100 - TPS_ACCEL);
    afr = accel + (wot - accel) * k;
  }

  // WOT rpm tinggi: melenai sedikit menuju afrWotHigh saat rpm mendekati maxRPM.
  const hi = s.maxRPM * WOT_HI_RPM;
  if (tpsPct >= TPS_ACCEL && rpm > hi) {
    const k = clamp((rpm - hi) / Math.max(s.maxRPM - hi, 1), 0, 1);
    afr = afr + (wotHigh - afr) * k;
  }
  return afr;
}

// Luas curtain klep intake (mm²) = keliling klep × lift
export function curtainIntake(s: EngineSpec): number {
  return Math.PI * s.valveIntakeMM * s.intakeLift;
}

// Aturan drag race: ceiling power ~ luas curtain × 0.0263 HP/mm²
export function flowCeilingHP(s: EngineSpec): number {
  return curtainIntake(s) * 0.0263;
}

export function horsepowerAt(
  s: EngineSpec,
  rpm: number,
  afr = afrFor(s, rpm, 100),
): number {
  const mAir = airflowGS(s, rpm) / 1000; // kg/s
  const mFuel = mAir / afr; // kg/s
  const kw = mFuel * FUEL_ENERGY_MJ_KG * s.thermalEff * 1000; // kg/s * MJ/kg = MW -> *1000 = kW
  return Math.min(kw * 1.34102, flowCeilingHP(s)); // kW -> HP, dibatasi luas klep
}

export function injectorFlow_gPerMs(s: EngineSpec): number {
  // cc/min rating umumnya saat 3.0 bar; flow aktual ≈ rating × sqrt(tekanan/3)
  const ccAtPress =
    s.injectorFlowCC * Math.sqrt(Math.max(s.fuelPressureBar, 0.5) / 3);
  return (ccAtPress * FUEL_DENSITY_G_CC) / 60000;
}

// Base Map (ms): durasi injeksi default per RPM × TPS (format JUKEN)
export function baseMapMs(s: EngineSpec, rpm: number, tpsPct: number): number {
  return round2(pulseWidthMs(s, rpm, afrFor(s, rpm, tpsPct), tpsPct));
}

// Waktu injeksi (ms) per silinder per putaran hisap
export function pulseWidthMs(
  s: EngineSpec,
  rpm: number,
  afr: number,
  tpsPct: number,
): number {
  const fuelGS = airflowAt(s, rpm, tpsPct) / afr; // g/s total
  const cyclesPerSec = Math.max(rpm / 120, 1);
  const fuelPerCycle = fuelGS / cyclesPerSec; // g per seluruh silinder per 2 putaran
  const per = fuelPerCycle / Math.max(s.injectorCount, 1);
  const flow = injectorFlow_gPerMs(s);
  if (flow <= 0) return 0;
  return per / flow + s.injectorDeadTime;
}

// Durasi injeksi dalam derajat crank
export function injectionDegrees(pwMs: number, rpm: number): number {
  return Math.max(pwMs, 0) * rpm * 0.006;
}

function scanPower(s: EngineSpec): { hp: number; rpm: number } {
  let best = { hp: 0, rpm: 1000 };
  const top = Math.max(s.maxRPM, 3000);
  for (let rpm = 1000; rpm <= top; rpm += 250) {
    const hp = horsepowerAt(s, rpm);
    if (hp > best.hp) best = { hp, rpm };
  }
  return best;
}

export function computeStats(s: EngineSpec): EngineStats {
  const cc = sweptCC(s);
  const clearanceCC = cc / Math.max(s.compressionRatio - 1, 0.1);
  const cam = camEvents(s);
  const torqueRPM = torquePeakRPM(s);
  const powerRPM = powerPeakRPM(s);

  const airAtTorque = airflowGS(s, torqueRPM);
  const airAtPower = airflowGS(s, powerRPM);
  const fuelGSmax =
    Math.max(airAtTorque, airAtPower) / afrFor(s, powerRPM, 100);

  const injTotalCC = (fuelGSmax * 60) / FUEL_DENSITY_G_CC; // cc/min total
  const injCount = Math.max(s.injectorCount, 1);
  const injRequiredPer = injTotalCC / MAX_DUTY / injCount;
  const injInstalledCC = s.injectorFlowCC * injCount;
  const dutyAtPeak =
    s.injectorFlowCC > 0 ? injTotalCC / injCount / s.injectorFlowCC : 0;
  const br = boreRealMM(s);
  const safeDiv = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  return {
    boreRealMM: br,
    sweptCC: round2(cc),
    clearanceCC: round2(clearanceCC),
    cam,
    torquePeakRPM: torqueRPM,
    powerPeakRPM: powerRPM,
    powerPeakHP: round1(scanPower(s).hp),
    maxPistonSpeed: round2(pistonSpeedMs(s, s.maxRPM)),
    injRequiredCC: round1(injTotalCC),
    injRequiredPer: round1(injRequiredPer),
    injInstalledCC: round1(injInstalledCC),
    dutyAtPeak,
    tbsqToBoreRatio: Math.round(safeDiv(s.throttleBodyMM, br)),
    valveInRatio: Math.round(safeDiv(s.valveIntakeMM, br)),
    valveExRatio: Math.round(safeDiv(s.valveExhaustMM, br)),
    curtainInMM2: Math.round(curtainIntake(s)),
    flowCeilingHP: round1(flowCeilingHP(s)),
    headerVsBore: Math.round(safeDiv(s.exhaustP1MM, br)),
  };
}

// --- Base mapa (dihitung dari spek) ---

// Fuel: baseline = 100% koreksi. Nilai % terhadap PW dasar dari airflow.
export function baseIgnitionDeg(
  s: EngineSpec,
  rpm: number,
  tpsPct: number,
): number {
  let adv = 8 + rpm * 0.0042;
  adv = clamp(adv, 4, 33);
  adv += (s.compressionRatio - 11) * -0.7;
  adv += (s.octane - 92) * 0.06;
  adv += (camEvents(s).overlap - 40) * -0.04;
  const loadCorr = (1 - tpsPct / 100) * 4;
  return round1(clamp(adv + loadCorr, 0, 60));
}

// EOI dasar (End of Injection) dalam °BTDC: injeksi berakhir saat klep intake mulai buka
export function baseEoiDeg(s: EngineSpec): number {
  return round1(camEvents(s).ivo + s.injPhaseOffset);
}

export function rpmGrid(s: EngineSpec): number[] {
  const step = Math.max(Math.round(s.rpmStep), 50);
  const idle = Math.max(Math.round(s.idleRPM), JUKEN_RPM_START);
  const top = Math.max(Math.round(s.maxRPM), idle + step);
  const out: number[] = [];
  for (let rpm = idle; rpm <= top + step / 2; rpm += step) out.push(rpm);
  return out;
}
