import type { CamEvents, EngineSpec, EngineStats } from "./types";
import { JUKEN_RPM_START } from "./types";

export const AIR_DENSITY_G_L_REF = 1.184; // udara 20°C, 1 atm (referensi)
export const FUEL_DENSITY_G_CC = 0.75; // bensin
export const FUEL_ENERGY_MJ_KG = 43.5;
// Cadangan bila field AFR user masih 0 (kosong)
export const AFR_IDLE = 13.8;
export const AFR_WOT = 12.4;
export const MAX_DUTY = 0.85;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);
const round1 = (v: number) => Math.round(v * 10) / 10;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round2 = (v: number) => Math.round(v * 100) / 100;

// Densitas udara (g/L) dari suhu intake & ketinggian — barometric formula ISO 2533.
// P = 101325*(1 - 0.0065*h/288.15)^5.2559, lalu rho = P/(R*T). Sebagai fallback saat
// ketinggian/suhu 0 dipakai acuan 20°C, 1 atm (1.184 g/L).
export function airDensityGL(s: EngineSpec): number {
  const h = Math.max(s.altitudeM || 0, 0);
  const tC = s.airTempC || 20;
  const P0 = 101325;
  const T0 = 288.15; // K
  const lapse = 0.0065; // K/m
  const R = 287.05; // J/(kg·K)
  const T = tC + 273.15;
  const P = h > 0 ? P0 * Math.pow(1 - (lapse * h) / T0, 5.2559) : P0;
  const rho = (P / (R * T)) * 1000; // kg/m³ -> g/L
  // Normalisasi ke referensi 1.184 g/L (20°C, 1 atm) supaya nilai default
  // (altitude 0, suhu 0) identik dengan konstanta lama di map & HP estimasi.
  const ref = (P0 / (R * 293.15)) * 1000;
  return round2((rho / ref) * AIR_DENSITY_G_L_REF);
}

// Batas putaran nyata mesin = limiter ECU; kalau 0/kosong pakai tinggi tabel (maxRPM).
export function redlineRPM(s: EngineSpec): number {
  return Math.max(s.limiterRPM || s.maxRPM, 2000);
}

// Batas aman kecepatan piston (m/s) untuk rakitan standar/racing
export const MAX_PISTON_SPEED_SAFE = 22; // standar: di bawah ini aman
export const MAX_PISTON_SPEED_RACE = 25; // racing baut bagus: masih toleran

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
    altitudeM: 0, // koreksi densitas: 0 = permukaan laut (netral)
    airTempC: 20, // 20°C = netral (sama dgn referensi 1.184 g/L lama)

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
    ignBaseOffset: 0, // koreksi cara-baca device (default netral 0°)

    // Target AFR per kondisi (default setup Motor Gw — bore-up/drag, CR 12.8, oktan 98:
    // sedikit lebih kaya dari standard tune biar aman dari detonasi/hot, idle lebih kaya
    // karena overlap cam besar bikin vacuum idle rendah)
    afrIdle: 13.8, // idle (cam besar & CR tinggi: 13.5–13.8)
    afrCruise: 13.8, // jalan santai (CR tinggi: 13.5–13.8)
    afrAccel: 13.0, // bukaan menengah (12.8–13.2)
    afrWot: 12.6, // WOT / beban tinggi (bore-up drag: 12.4–12.8)
    afrWotHigh: 12.4, // WOT + rpm tinggi (lebih kaya utk dinginkan, 12.2–12.5)

    // Grid mapping (format JUKEN: awal 1000, step 250, mentok 16000 = 61 titik — bisa diubah user)
    idleRPM: 1600, // idle asli mesin (referensi; tabel tetap mulai 1000 di JUKEN)
    maxRPM: 16000, // tinggi tabel JUKEN (jangan turunkan)
    limiterRPM: 12000, // batas putaran nyata ECU milik motor gw
    rpmStep: 250,
  };
}

// Setup Umum: field yang DIPAKAI hitung map dimulai 0 (kosong — user mengisi,
// aplikasi memberi tanda alert bila 0). Field opsional (tidak dipakai hitung map)
// diberi nilai default wajar supaya tidak menyesatkan.
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
    intakeLift: 8.8, // opsional (statistik)
    exhaustLift: 9.1, // opsional (tidak dipakai)
    injectorFlowCC: 0,
    injectorCount: 1,
    fuelPressureBar: 0,
    injectorDeadTime: 0,
    throttleBodyMM: 32, // opsional (statistik TB)
    veMax: 0,
    altitudeM: 0,
    airTempC: 20, // netral
    valveIntakeMM: 30, // opsional (statistik)
    valveExhaustMM: 25, // opsional (statistik)
    exhaustP1MM: 0,
    exhaustInletMM: 38, // opsional (tidak dipakai)
    exhaustOutletMM: 0, // dipakai rumus (taper megaphone) — alert bila 0
    octane: 0,
    thermalEff: 0.3, // opsional (estimasi HP)
    injPhaseOffset: 0,
    ignBaseOffset: 0, // koreksi cara-baca device (default netral 0°)
    afrIdle: 0,
    afrCruise: 0,
    afrAccel: 0,
    afrWot: 0,
    afrWotHigh: 0,
    idleRPM: 1600, // referensi (tabel tetap 1000)
    maxRPM: 16000,
    limiterRPM: 0,
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

// Estimasi titik torsi puncak dari durasi noken, knalpot & batas putaran mesin (limiter)
export function torquePeakRPM(s: EngineSpec): number {
  const max = redlineRPM(s);
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
  const max = redlineRPM(s);
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
  return veAt(s, rpm) * (sweptCC(s) / 1000) * airDensityGL(s) * (rpm / 120);
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
const WOT_HI_RPM = 0.85; // 85% limiter = zona rpm tinggi

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

  // WOT rpm tinggi: melenai sedikit menuju afrWotHigh saat rpm mendekati limiter.
  const hi = redlineRPM(s) * WOT_HI_RPM;
  if (tpsPct >= TPS_ACCEL && rpm > hi) {
    const k = clamp((rpm - hi) / Math.max(redlineRPM(s) - hi, 1), 0, 1);
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

// Koreksi fuel (%) dari AFR terukur AFR meter agar menjadi AFR target.
// Base Map dihitung utk target AFR; bila terukur lebih kurus (afr di atas target),
// tambah fuel dengan faktor (terukur/target − 1). Contoh: terukur 13.8 vs target
// 12.6 → koreksi +9.5%.
export function calibrationCorrPct(
  s: EngineSpec,
  rpm: number,
  tpsPct: number,
  measuredAfr: number,
): number {
  if (!measuredAfr || measuredAfr <= 0) return 0;
  const target = afrFor(s, rpm, tpsPct);
  if (!target || target <= 0) return 0;
  return round1((measuredAfr / target - 1) * 100);
}

function scanPower(s: EngineSpec): { hp: number; rpm: number } {
  let best = { hp: 0, rpm: 1000 };
  const top = redlineRPM(s);
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
  const dutyAt = (rpm: number) =>
    s.injectorFlowCC > 0
      ? (airflowGS(s, rpm) / afrFor(s, rpm, 100)) *
        (60 / FUEL_DENSITY_G_CC) /
        injCount /
        s.injectorFlowCC
      : 0;
  const dutyAtPeak =
    s.injectorFlowCC > 0 ? injTotalCC / injCount / s.injectorFlowCC : 0;
  const dutyAtLimiter = dutyAt(redlineRPM(s));
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
    maxPistonSpeed: round2(pistonSpeedMs(s, redlineRPM(s))),
    injRequiredCC: round1(injTotalCC),
    injRequiredPer: round1(injRequiredPer),
    injInstalledCC: round1(injInstalledCC),
    dutyAtPeak,
    dutyAtLimiter,
    tbsqToBoreRatio: Math.round(safeDiv(s.throttleBodyMM, br)),
    valveInRatio: Math.round(safeDiv(s.valveIntakeMM, br)),
    valveExRatio: Math.round(safeDiv(s.valveExhaustMM, br)),
    curtainInMM2: Math.round(curtainIntake(s)),
    flowCeilingHP: round1(flowCeilingHP(s)),
    headerVsBore: Math.round(safeDiv(s.exhaustP1MM, br)),
  };
}

// --- Base mapa (dihitung dari spek) ---

// Ignition (BTDC°).
// Kalibrasi terhadap mappingan STOCK JUKEN (mis. Vario 125 LED New) yang TERBUKTI
// jalan di spek CR12.8 + RON 98 — "galak" tapi aman saat diikuti speknya:
//  - idle 15° sampai ~0.21×redline (semua beban, base ECU).
//  - Beban ringan: naik cepat ke 39° (silinder tidak terbebani → aman maju).
//  - TPS menengah: naik ke ~27°, tahan, lalu naik ke ~36° mendekati redline.
//  - WOT: naik ke ~23°, tahan di band tengah (anti detonasi), naik ke 33° di top-end.
//  - Taper -1° di atas redline.
// Skala spek: nilai acuan = CR 12.8 / RON 98. CR & oktan di luar itu digeser
// proporsional; plafon detonasi keras tergantung CR & beban (WOT paling ketat).
export function baseIgnitionDeg(
  s: EngineSpec,
  rpm: number,
  tpsPct: number,
): number {
  const red = Math.max(redlineRPM(s), 2000);
  const load = clamp(tpsPct / 100, 0, 1); // 0 = ringan, 1 = WOT
  const f = clamp(rpm / red, 0, 1.35); // fraksi redline

  // Nilai acuan terkalibrasi ke stock JUKEN (CR 12.8, RON 98)
  const idleAdv = 15;
  const peak = 33 + 6 * (1 - load); // 33 (WOT)..39 (ringan), ala stock
  const plateau = 23 + 16 * Math.pow(1 - load, 2); // 23 (WOT)..39 (ringan)
  const f1e = 0.25 + 0.125 * (1 - load); // akhir ramp pertama
  const fIdle = 0.21;
  const fTopS = 0.67; // mulai top-end ramp
  const fTopE = 0.8; // selesai → peak

  let adv: number;
  if (f <= fIdle) adv = idleAdv;
  else if (f <= f1e)
    adv = lerp(idleAdv, plateau, (f - fIdle) / (f1e - fIdle));
  else if (f <= fTopS) adv = plateau;
  else if (f <= fTopE)
    adv = lerp(plateau, peak, (f - fTopS) / (fTopE - fTopS));
  else adv = peak;

  // Taper di atas redline (ECU bawaan: -1° setelah limiter)
  if (f > 1) adv -= Math.min(1, (f - 1) * 4);

  // Koreksi spek — acuan CR 12.8 / RON 98 (yang terbukti di stock).
  const crCorr = (12.8 - s.compressionRatio) * 0.3;
  const octCorr = (s.octane - 98) * 0.15;
  const ovCorr = (40 - camEvents(s).overlap) * 0.03;
  adv += crCorr + octCorr + ovCorr + (s.ignBaseOffset || 0);

  // Plafon detonasi: WOT paling ketat; beban ringan boleh lebih maju.
  // CR jauh di atas acuan stock → dikunci mundur.
  const wotCeil =
    s.compressionRatio >= 13.7 ? 31 : s.compressionRatio >= 12.4 ? 34 : 36;
  const lowOct = s.octane < 95 ? wotCeil - 2 : wotCeil;
  const hardCeil = load >= 0.8 ? lowOct : Math.min(lowOct + 6, 40);

  return round1(clamp(adv, 4, hardCeil));
}

// EOI dasar (End of Injection) dalam °BTDC: injeksi berakhir saat klep intake mulai buka
export function baseEoiDeg(s: EngineSpec): number {
  return round1(camEvents(s).ivo + s.injPhaseOffset);
}

// Kolom pertama tabel selalu 1000 (JUKEN_RPM_START) — format JUKEN 5++.
// idleRPM tetap disimpan sebagai nilai referensi idle mesin (mis. 1600) tapi
// TIDAK menggeser posisi kolom grid, supaya paste ke JUKEN tidak bergeser.
export function rpmGrid(s: EngineSpec): number[] {
  const step = Math.max(Math.round(s.rpmStep), 50);
  const idle = JUKEN_RPM_START; // 1000 — format tabel JUKEN
  const top = Math.max(Math.round(s.maxRPM), idle + step);
  const out: number[] = [];
  for (let rpm = idle; rpm <= top + step / 2; rpm += step) out.push(rpm);
  return out;
}

export interface SpecWarning {
  severity: 'danger' | 'warn' | 'ok';
  msg: string;
}

// Guardrail: cek spek terhadap batas fisika & keselamatan, beri saran perbaikan.
// Memakai stats yang dihitung (duty, piston speed, rasio) + aturan tuning umum.
export function validateSpec(s: EngineSpec, stats: EngineStats): SpecWarning[] {
  const w: SpecWarning[] = [];
  const st = stats;
  const br = st.boreRealMM;

  const push = (sev: SpecWarning['severity'], msg: string) => w.push({ severity: sev, msg });

  // 1. Kecepatan piston
  if (st.maxPistonSpeed > MAX_PISTON_SPEED_RACE) {
    push('danger', `Kecepatan piston ${st.maxPistonSpeed} m/s MELEBIHI batas balap 25 m/s — risiko kerusakan ring piston & klep. Turunkan limiter atau perbesar stroke jangan dinaikkan.`);
  } else if (st.maxPistonSpeed > MAX_PISTON_SPEED_SAFE) {
    push('warn', `Kecepatan piston ${st.maxPistonSpeed} m/s di atas aman standar 22 m/s — cek baut penguat, conrod, dan piston balap.`);
  }

  // 2. Duty cycle injector
  const worstDuty = Math.max(st.dutyAtPeak, st.dutyAtLimiter);
  if (worstDuty > 0.95) {
    push('danger', `Duty cycle ${(worstDuty * 100).toFixed(0)}% — injector WAJIB diganti atau naikkan flow. Duty >80% berisiko stroke pendek & gagal semprot.`);
  } else if (worstDuty > MAX_DUTY) {
    push('warn', `Duty cycle ${(worstDuty * 100).toFixed(0)}% di atas acuan aman 85%. Pertimbangkan injector lebih besar atau naikan tekanan.`);
  }
  if (st.dutyAtPeak > 0 && st.injInstalledCC < st.injRequiredPer) {
    push('warn', `Injector terpasang ${st.injInstalledCC} cc/min < butuh ${st.injRequiredPer} cc/min — kurangi aliran atau ganti injector lebih besar.`);
  }

  // 3. Rasio TB vs bore (persen)
  const tbRatio = st.tbsqToBoreRatio;
  if (br > 0) {
    if (tbRatio < 35) push('warn', `Throttle body ${s.throttleBodyMM} mm = ${st.tbsqToBoreRatio}% bore — sempit utk rpm tinggi, power band jadi bawah.`);
    if (tbRatio > 75 && s.veMax >= 1) push('warn', `TB ${s.throttleBodyMM} mm = ${st.tbsqToBoreRatio}% bore — terlalu besar utk VE 1.0, low-end kehilangan respons.`);
  }

  // 4. Klep vs bore
  if (br > 0) {
    if (st.valveInRatio < 40) push('warn', `Klep intake ${s.valveIntakeMM} mm = ${st.valveInRatio}% bore — kecil, batasi aliran high-rpm.`);
    if (st.valveInRatio > 65) push('warn', `Klep intake ${s.valveIntakeMM} mm = ${st.valveInRatio}% bore — besar, perlu valvetrain kokoh & piston relief.`);
  }

  // 5. Overlap noken
  const ov = st.cam.overlap;
  if (ov < 0) push('danger', `Overlap noken NEGATIF (${ov}°). Cek angka buka/tutup — cam intake & exhaust kemungkinan salah arah.`);
  else if (s.octane < 95 && ov > 60) push('warn', `Overlap besar ${ov}° tapi oktan ${s.octane} — risiko valvetrain & detonasi di low-rpm.`);
  else if (ov > 85) push('warn', `Overlap ${ov}° sangat besar — idle akan kasar, butuh AFR idle lebih kaya.`);

  // 6. Kompresi vs oktan
  if (s.compressionRatio > 13.5 && s.octane < 98) push('warn', `CR ${s.compressionRatio} tinggi utk oktan ${s.octane} — wajib RON 98+ atau turunkan piston.`);
  else if (s.compressionRatio > 0 && s.compressionRatio < 11 && s.octane > 92) push('warn', `CR ${s.compressionRatio} rendah — oktan ${s.octane} mubazir; penurunan timing terlalu lambat.`);

  // 7. Limiter vs tabel
  const red = redlineRPM(s);
  if (s.limiterRPM > 0 && red > s.maxRPM) push('warn', `Limiter ${red} rpm melebihi tinggi tabel ${s.maxRPM} rpm — kolom di atas tidak ada di JUKEN.`);

  // 8. Flow ceiling klep vs estimasi power
  const feasi = st.flowCeilingHP;
  const peak = st.powerPeakHP;
  if (feasi > 0 && peak > feasi * 1.05) push('warn', `Power estimasi ${peak} HP mendekati/di atas ceiling klep ${feasi} HP — cek lebar klep atau head.`);

  // 9. Masukan kosong (Setup Umum)
  if (!s.boreMM || !s.strokeMM) push('warn', `Bore/stroke belum diisi — isi spek dulu supaya hitungan akurat.`);
  if (!s.injectorFlowCC) push('warn', `Flow injector belum diisi — Base Map akan 0 ms tanpa spek injector.`);

  if (w.length === 0) push('ok', 'Spek terlihat konsisten. Tetap kalibrasi final dengan AFR meter/dyno.');
  return w;
}

// --- Meta field spek untuk UI Setup ---
// isMap: ikut diperhitungkan dalam Base Map / Ignition / Injector Timing.
// Unused: field yang TIDAK dipakai rumus (hanya statistik/preview/guardrail) —
// 0 pada field ini TIDAK merusak map, jadi tetap bernilai default yang wajar.
export interface SpecFieldMeta {
  label: string;
  isMap: boolean; // dipakai hitung map
  unused?: boolean; // sama sekali tidak dipakai rumus mana pun
  reason: string;
}

export const SPEC_FIELDS: Record<keyof EngineSpec, SpecFieldMeta> = {
  name: { label: 'Nama Setup', isMap: false, unused: true, reason: 'Label saja' },
  boreMM: { label: 'Bore', isMap: true, reason: 'Volume silinder → Base Map' },
  strokeMM: { label: 'Stroke', isMap: true, reason: 'Volume silinder → Base Map & kecepatan piston' },
  cylinders: { label: 'Silinder', isMap: true, reason: 'Volume total → Base Map' },
  oversizeMM: { label: 'Over Size', isMap: true, reason: 'Bore asli → volume → Base Map' },
  compressionRatio: { label: 'Rasio Kompresi', isMap: true, reason: 'Timing Ignition & volume burni' },
  intakeIVO: { label: 'IN Buka', isMap: true, reason: 'Durasi cam → puncak torsi, EOI, ignition' },
  intakeIVC: { label: 'IN Tutup', isMap: true, reason: 'Durasi cam → puncak torsi' },
  exhaustEVO: { label: 'EX Buka', isMap: true, reason: 'Durasi cam → puncak torsi' },
  exhaustEVC: { label: 'EX Tutup', isMap: true, reason: 'Durasi cam & overlap → puncak torsi, ignition' },
  intakeLift: { label: 'Lift Intake', isMap: false, unused: true, reason: 'Hanya estimasi HP ceiling (statistik)' },
  exhaustLift: { label: 'Lift Exhaust', isMap: false, unused: true, reason: 'Tidak dipakai sama sekali' },
  injectorFlowCC: { label: 'Flow Injektor', isMap: true, reason: 'Base Map & duty cycle' },
  injectorCount: { label: 'Jumlah Injektor', isMap: true, reason: 'Base Map per injector' },
  fuelPressureBar: { label: 'Tekanan Bensin', isMap: true, reason: 'Flow nyata injector → Base Map' },
  injectorDeadTime: { label: 'Dead Time', isMap: true, reason: 'Offset durasi injeksi → Base Map' },
  throttleBodyMM: { label: 'Diameter TB', isMap: false, unused: true, reason: 'Hanya rasio TB vs bore (statistik)' },
  veMax: { label: 'VE Maks', isMap: true, reason: 'Aliran udara → Base Map' },
  altitudeM: { label: 'Ketinggian', isMap: true, reason: 'Densitas udara → Base Map' },
  airTempC: { label: 'Suhu Intake', isMap: true, reason: 'Densitas udara → Base Map' },
  valveIntakeMM: { label: 'Klep Intake', isMap: false, unused: true, reason: 'Hanya rasio klep & ceiling HP (statistik)' },
  valveExhaustMM: { label: 'Klep Exhaust', isMap: false, unused: true, reason: 'Hanya rasio klep (statistik)' },
  exhaustP1MM: { label: 'Header P1', isMap: true, reason: 'Puncak torsi & posisi powerband' },
  exhaustInletMM: { label: 'Inlet Knalpot', isMap: false, unused: true, reason: 'Tidak dipakai sama sekali' },
  exhaustOutletMM: { label: 'Outlet Knalpot', isMap: true, reason: 'Taper megaphone → puncak torsi' },
  octane: { label: 'Oktan', isMap: true, reason: 'Timing Ignition' },
  thermalEff: { label: 'Efisiensi Termal', isMap: false, unused: true, reason: 'Hanya estimasi HP (statistik)' },
  injPhaseOffset: { label: 'Offset Fase Injeksi', isMap: true, reason: 'Sudut EOI n Timing' },
  ignBaseOffset: { label: 'Offset Bacaan Ignition', isMap: true, reason: 'Timing Ignition' },
  afrIdle: { label: 'AFR Idle', isMap: true, reason: 'Target Base Map zona idle' },
  afrCruise: { label: 'AFR Cruising', isMap: true, reason: 'Target Base Map zona menjelajah' },
  afrAccel: { label: 'AFR Akselerasi', isMap: true, reason: 'Target Base Map zona menengah' },
  afrWot: { label: 'AFR WOT', isMap: true, reason: 'Target Base Map zona beban penuh' },
  afrWotHigh: { label: 'AFR WOT Tinggi', isMap: true, reason: 'Target Base Map WOT rpm tinggi' },
  idleRPM: { label: 'Idle RPM', isMap: false, unused: true, reason: 'Referensi saja (tabel tetap mulai 1000)' },
  maxRPM: { label: 'Max RPM', isMap: true, reason: 'Tinggi tabel & aliran batas' },
  limiterRPM: { label: 'Limiter RPM', isMap: true, reason: 'Batas putaran → puncak torsi/power, AFR high' },
  rpmStep: { label: 'RPM Step', isMap: true, reason: 'Pola kolom RPM tabel JUKEN' },
};

// Field yang TIDAK dipakai hitung map — boleh 0 tanpa merusak tabel.
export const UNUSED_MAP_FIELDS = (Object.keys(SPEC_FIELDS) as (keyof EngineSpec)[]).filter(
  (k) => SPEC_FIELDS[k].unused,
);

// Field yang DIPAKAI hitung map — value 0 / tidak wajar = tabel hasil salah.
export interface SpecInputIssue {
  key: keyof EngineSpec;
  label: string;
  msg: string;
}

export function specInputIssues(s: EngineSpec): SpecInputIssue[] {
  const out: SpecInputIssue[] = [];
  const add = (key: keyof EngineSpec, msg: string) =>
    out.push({ key, label: SPEC_FIELDS[key].label, msg });

  // Dimensi mesin wajib > 0
  if (!s.boreMM) add('boreMM', '0 — hasil Base Map ikut 0. Isi diameter piston.');
  if (!s.strokeMM) add('strokeMM', '0 — hasil Base Map ikut 0. Isi langkah piston.');
  if (!s.cylinders) add('cylinders', '0 — volume total 0.');

  // Injector wajib
  if (!s.injectorFlowCC) add('injectorFlowCC', '0 — Base Map jadi 0 ms (fallback tanpa injector).');
  if (!s.injectorCount) add('injectorCount', '0 — tidak ada injector terhitung.');
  if (!s.fuelPressureBar) add('fuelPressureBar', '0 — flow injector dianggapkan 0.5 bar (sangat berkurang).');
  if (!s.injectorDeadTime) add('injectorDeadTime', '0 — PW tanpa dead time berlebih pendek di low rpm.');

  // Udara wajib
  if (!s.veMax) add('veMax', '0 — aliran udara 0 g/s, Base Map 0 ms.');
  if (!s.maxRPM) add('maxRPM', '0 — tabel tidak punya tinggi kolom (pakai 16000).');

  // Ignition wajib
  if (!s.compressionRatio) add('compressionRatio', '0 — timing ignition tidak terkompensasi CR.');
  if (!s.octane) add('octane', '0 — timing ignition dianggapkan oktan 92.');

  // AFR wajib (0 = pakai acuan bawaan)
  if (!s.afrIdle) add('afrIdle', '0 — pakai acuan bawaan 13.8.');
  if (!s.afrCruise) add('afrCruise', '0 — pakai acuan bawaan 13.8.');
  if (!s.afrAccel) add('afrAccel', '0 — pakai acuan bawaan.');
  if (!s.afrWot) add('afrWot', '0 — pakai acuan bawaan 12.4.');

  // Cam wajib (0 = durasi tidak valid)
  if (!s.intakeIVO && !s.intakeIVC) add('intakeIVO', 'Buka+tutup intake 0 — durasi cam lenyap.');
  if (!s.exhaustEVO && !s.exhaustEVC) add('exhaustEVO', 'Buka+tutup exhaust 0 — durasi cam lenyap.');

  // Knalpot wajib
  if (!s.exhaustP1MM) add('exhaustP1MM', '0 — puncak torsi/posisi powerband tanpa acuan header.');
  if (!s.exhaustOutletMM) add('exhaustOutletMM', '0 — taper megaphone tanpa acuan outlet.');

  return out;
}
