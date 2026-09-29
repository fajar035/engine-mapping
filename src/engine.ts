import type { CamEvents, EngineSpec, EngineStats } from "./types";
import { JUKEN_RPM_START } from "./types";

export const AIR_DENSITY_G_L_REF = 1.184; // udara 20°C, 1 atm (referensi)
export const FUEL_DENSITY_G_CC = 0.75; // bensin
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
    engineType: "single4", // hanya suara idle
    oversizeMM: 0,
    compressionRatio: 12.8,

    // Noken As (event klep, derajat crank)
    intakeIVO: 29, // IN buka °BTDC
    intakeIVC: 53, // IN tutup °ABDC
    exhaustEVO: 57, // EX buka °BBDC
    exhaustEVC: 27, // EX tutup °ATDC

    // Injector
    // 200 cc/min = flow injektor yang terpasang di motor (aftermarket 10-hole),
    // rating pada 3 bar — tekanan rail harus sama dengan `fuelPressureBar` di bawah.
    // Catatan: back-calculate dari tabel Base Map stok JUKEN (referensi beda) cuma
    // mentok di 140–145 cc/min; kalau ganti injector, ubah angka ini.
    injectorFlowCC: 200,
    injectorCount: 1,
    fuelPressureBar: 3,
    injectorDeadTime: 0.65,

    // Pasokan udara
    veMax: 0.98,
    altitudeM: 0, // koreksi densitas: 0 = permukaan laut (netral)
    airTempC: 60, // 20°C = netral (sama dgn referensi 1.184 g/L lama)

    // Knalpot (drag pipe)
    exhaustP1MM: 30,
    exhaustOutletMM: 45,

    // Bahan bakar & pembacaan ECU
    octane: 98,
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
    maxRPM: 16000, // tinggi tabel JUKEN (jangan turunkan)
    limiterRPM: 11000, // batas putaran nyata ECU milik motor gw
    rpmStep: 250,
  };
}

// Setup Umum: field yang DIPAKAI hitung map dimulai 0 (kosong — user mengisi,
// aplikasi memberi tanda alert bila 0). Semua field di bawah ikut hitung
// Base Map / Ignition / Injector Timing, jadi wajib terisi.
export function emptySpec(): EngineSpec {
  return {
    name: "Setup Umum",
    boreMM: 0,
    strokeMM: 0,
    cylinders: 1,
    engineType: "single4", // hanya suara idle
    oversizeMM: 0,
    compressionRatio: 0,
    intakeIVO: 0,
    intakeIVC: 0,
    exhaustEVO: 0,
    exhaustEVC: 0,
    injectorFlowCC: 0,
    injectorCount: 1,
    fuelPressureBar: 0,
    injectorDeadTime: 0,
    veMax: 0,
    altitudeM: 0,
    airTempC: 20, // netral
    exhaustP1MM: 0,
    exhaustOutletMM: 0, // dipakai rumus (taper megaphone) — alert bila 0
    octane: 0,
    injPhaseOffset: 0,
    ignBaseOffset: 0, // koreksi cara-baca device (default netral 0°)
    afrIdle: 0,
    afrCruise: 0,
    afrAccel: 0,
    afrWot: 0,
    afrWotHigh: 0,
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
// --- Kurva VE (WOT), dikalibrasi ke base map lapangan -------------------
// Bentuk DAN besar VE diambil dari base map JUKEN 21×61 yang benar-benar dipakai
// di motor (bore 63 / stroke 57.9 = 180.5 cc, injector 200 cc/min @3 bar, dead
// time 0.65 ms). Karena pada AFR tetap VE sebanding dengan (PW − dead time), tabel
// PW lapangan bisa langsung dibalik menjadi kurva VE.
//
// Temuan utama: model VE lama (puncak = veMax = 0.98) ternyata 12–13% lebih
// tinggi dari VE nyata motor di seluruh rpm. Akibatnya AFR implicit pada WOT
// di Base Map lama sekitar 14.1 (kering) walau target app 12.6, terutama di
// segmen rpm tinggi yang terasa "berat". Di bawah ini VE puncak diturunkan ke
// 0.87 × veMax dengan bentuk kurva yang sama, sehingga map hasil app ≈ map
// lapangan (deviasi <1% di seluruh 21×61 sel).
const VE_PEAK_EFF = 0.87; // VE puncak ÷ veMax
const VE_CAL_PEAK_RPM = 7600; // rpm puncak acuan hasil pembalikan data field

// [rpm acuan, VE ÷ VE puncak] — datar dari 1000 rpm ke puncak, lalu turun steadily
// ke top-end (0.59 di 16000) karena rugya pompa & imas.
const VE_SHAPE: readonly (readonly [number, number])[] = [
  [1000, 0.822],
  [2000, 0.83],
  [3000, 0.84],
  [4000, 0.856],
  [5000, 0.901],
  [6000, 0.945],
  [7000, 0.99],
  [7600, 1.0],
  [9000, 0.919],
  [10000, 0.873],
  [12000, 0.786],
  [14000, 0.688],
  [16000, 0.59],
];

// Rasio VE ÷ VE-puncak pada rpm tertentu. Sumbu rpm diskala ke rpm puncak model
// supaya cam/knalpot yang menggeser powerband ikut menggeser kurvanya.
function veShape(s: EngineSpec, rpm: number): number {
  const cal = rpm * (VE_CAL_PEAK_RPM / Math.max(torquePeakRPM(s), 1));
  const k = VE_SHAPE;
  const first = k[0];
  if (cal <= first[0]) return first[1];
  const last = k[k.length - 1];
  if (cal >= last[0]) return last[1];
  for (let i = 1; i < k.length; i++) {
    if (cal <= k[i][0]) {
      const [r0, v0] = k[i - 1];
      const [r1, v1] = k[i];
      return v0 + ((v1 - v0) * (cal - r0)) / (r1 - r0);
    }
  }
  return last[1];
}

// VE efektif pada WOT untuk rpm tertentu.
export function veAt(s: EngineSpec, rpm: number): number {
  if (!(s.veMax > 0)) return 0;
  return clamp(s.veMax * VE_PEAK_EFF * veShape(s, rpm), 0.3, s.veMax + 0.03);
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

// Fraksi aliran terhadap kondisi WOT pada rpm rendah–menengah (0..1).
// Kalibrasi dari tabel Base Map JUKEN asli: bukaan kecil menarik jauh lebih
// sedikit dari kapasitas mesin (TPS 0% ≈ 0.35, TPS 5% ≈ 0.42), baru penuh di
// ~70% bukaan. Flat-line ≥70% karena pembatasnya sudah berpindah ke kapasitas
// absolut plat (throttleArea).
const THROTTLE_FRACTION: [number, number][] = [
  [0, 0.35],
  [2, 0.38],
  [5, 0.42],
  [10, 0.52],
  [15, 0.62],
  [20, 0.71],
  [25, 0.8],
  [30, 0.86],
  [35, 0.91],
  [45, 0.94],
  [55, 0.96],
  [70, 1.0],
];

function throttleFraction(tpsPct: number): number {
  const k = THROTTLE_FRACTION;
  const t = clamp(tpsPct, 0, 100);
  if (t >= k[k.length - 1][0]) return 1;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, f0] = k[i - 1];
      const [t1, f1] = k[i];
      return f0 + ((f1 - f0) * (t - t0)) / (t1 - t0);
    }
  }
  return 1;
}

// Aliran udara efektif pada bukaan throttle tertentu (g/s).
// Dua pembatas bersamaan:
//  1. FRAC × natural — fraksi bukaan terhadap aliran WOT, dominan di rpm rendah
//     (natural kecil → throttle-lah yang menentukan). Tanpa ini, baris TPS 5%
//     di 1000 rpm menghasilkan aliran sama dgn baris WOT → idle/injeksi kering.
//  2. cap × throttleArea — kapasitas absolut plat butterfly, dominan di rpm
//     tinggi (natural melampaui kapasitas plat → aliran jenuh lalu menurun,
//     persis pola tabel JUKEN yang PW-nya turun setelah puncak).
export function airflowAt(s: EngineSpec, rpm: number, tpsPct: number): number {
  const natural = airflowGS(s, rpm);
  const cap = airflowGS(s, s.maxRPM) * 1.25; // headroom supaya WOT tidak terpotong
  return Math.min(
    natural * throttleFraction(tpsPct),
    cap * throttleArea(tpsPct),
  );
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

export function injectorFlow_gPerMs(s: EngineSpec): number {
  // cc/min rating umumnya saat 3.0 bar; flow aktual ≈ rating × sqrt(tekanan/3)
  const ccAtPress =
    s.injectorFlowCC * Math.sqrt(Math.max(s.fuelPressureBar, 0.5) / 3);
  return (ccAtPress * FUEL_DENSITY_G_CC) / 60000;
}

// Base Map (ms): durasi injeksi default per RPM × TPS (format JUKEN)
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
      ? ((airflowGS(s, rpm) / afrFor(s, rpm, 100)) * (60 / FUEL_DENSITY_G_CC)) /
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
    maxPistonSpeed: round2(pistonSpeedMs(s, redlineRPM(s))),
    injRequiredCC: round1(injTotalCC),
    injRequiredPer: round1(injRequiredPer),
    injInstalledCC: round1(injInstalledCC),
    dutyAtPeak,
    dutyAtLimiter,
    headerVsBore: Math.round(safeDiv(s.exhaustP1MM, br)),
  };
}

// --- Base mapa (dihitung dari spek) ---

// Ignition (BTDC°).
//
// Bentuk kurva diambil dari peta Ignition JUKEN motor ini, lalu DIPINDAH ke rpm
// dan besaran yang benar-benar menjelaskan mesin — supaya kalau speknya
// diganti, timingnya ikut berubah masuk akal, bukan cuma digeser 1°.
//
// Struktur peta acuan (3 tahap, dipisah per beban):
//   1. Garis dasar 15° (idle/cranks), lalu naik ke "cruise plateau".
//   2. Plateau per beban: 39° beban sangat ringan → 23° di beban ≥50%.
//   3. Di atas pita top-end, advance dinaikkan lagi ke "peak", lalu -1°.
//
// Yang DIPINDAH (bukan fraksi redline) supaya tidak ada artefak:
//   - Puppet naik (stage 1) bergantung BEBAN. Peta acuan: TPS 0 butuh 3000
//     rpm untuk sampai plateau, TPS 2 → 2750, TPS 5–25 → 2250, TPS ≥30 →
//     2000. Model lama memakai satu ramp untuk semua beban → meleset +17° di
//     TPS 0 / 2250 rpm.
//   - Pita top-end (stage 2) memakai rpm ABSOLUT yang digeser oleh durasi
//     buang (EGT). Model lama memakai fraksi redline, jadi naikkan limiter
//     12000→16000 diam-diam mengurangi advance WOT di 6000 rpm sebesar 5,4°
//     padahal kondisi mesin di rpm itu sama persis.
//   - Garis dasar 15° dipindah ke "satu siklus 4-tak ≈ 4,1 ms", yaitu waktu
//     yang dibutuhkan pembakaran selesai, jadi::~1750 rpm pada CR acuan.

// --- Konstanta acuan: motor yang datanya dipakai -------------------
const IGN_REF_CR = 12.8;
const IGN_REF_OCT = 98;
const IGN_REF_EX_DUR = 264; // 57 + 180 + 27
const IGN_REF_OVERLAP = 56; // ivo 29 + evc 27
const IGN_REF_BASE_RPM = 1750;
const IGN_TOP_START = 4250; // mulai re-advance top-end (peta acuan)
const IGN_TOP_SPAN = 500; // selesai di 4750
const IGN_DROP_AFTER = 2250; // -1° di 7000

// [TPS, rpm saat plateau tercapai] — dibaca dari peta acuan.
const IGN_RISE_END: readonly (readonly [number, number])[] = [
  [0, 3000],
  [2, 2750],
  [5, 2250],
  [20, 2200],
  [30, 2000],
  [1, 2000],
];

// [beban (0..1), advance °] — level cruise plateau & peak top-end per beban.
const IGN_PLATEAU: readonly (readonly [number, number])[] = [
  [0, 39],
  [0.25, 38],
  [0.3, 34],
  [0.35, 31],
  [0.4, 28],
  [0.45, 26],
  [0.5, 23],
  [1, 23],
];
const IGN_PEAK: readonly (readonly [number, number])[] = [
  [0, 39],
  [0.25, 38],
  [0.35, 37],
  [0.4, 36],
  [0.45, 35],
  [0.5, 33],
  [1, 33],
];

// Interpolasi linear tabel [x, y] pada x, di-clamp ke rentang tabel.
function tableAt(
  table: readonly (readonly [number, number])[],
  x: number,
): number {
  const first = table[0];
  if (x <= first[0]) return first[1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** Titik rpm yang dikalibrasi ke spek, tidak bergantung pada limiter ECU. */
function ignitionAnchors(s: EngineSpec) {
  // Garis dasar: CR lebih rendah = pembakaran lebih lambat = butuh lebih lama
  // per siklus = garis dasar duduk lebih tinggi.
  const baseRpm = clamp(
    IGN_REF_BASE_RPM + (IGN_REF_CR - s.compressionRatio) * 25,
    1400,
    2300,
  );
  // Pita top-end ikut EGT, jadi digeser durasi buang — durasi lebih panjang
  // = powerband lebih tinggi = re-advance lebih akhir. 10 rpm per ° durasi.
  const topStart = clamp(
    IGN_TOP_START + (exhaustDuration(s) - IGN_REF_EX_DUR) * 10,
    3000,
    9000,
  );
  return {
    baseRpm,
    topStart,
    topEnd: topStart + IGN_TOP_SPAN,
    dropAt: topStart + IGN_TOP_SPAN + IGN_DROP_AFTER,
  };
}

/**
 * Margin detonasi → koreksi advance (°). Ini inti "penyesuaian ke spek".
 * Beban penuh paling ketat; beban ringan hanya terkoreksi sebagian karena
 * campurannya kaya sehingga tidak ada risiko detonasi berarti.
 */
function ignitionKnockCorr(s: EngineSpec, load: number): number {
  // 1° CR lebih tinggi = ~1,8° lebih mundur.
  const cr = (IGN_REF_CR - s.compressionRatio) * 1.8;
  // 1 RON lebih rendah = ~0,55° mundur; 0 = oktan tidak diisi → pakai acuan.
  const oct = s.octane > 0 ? (s.octane - IGN_REF_OCT) * 0.55 : 0;
  // Udara panas = charge lebih sedikit & suhu silinder naik → mundur.
  const iat = ((s.airTempC || 30) - 30) * -0.1;
  return (cr + oct + iat) * (0.3 + 0.7 * load);
}

/**
 * Koreksi cam, dan sengajabergantung rpm karena tanda-tandanya berlawanan:
 *  - rpm bawah: overlap besar = TMB competitor saat katup masih buka = mundur.
 *  - rpm atas: overlap besar = EGT tinggi & scavenging bagus = tahan maju.
 */
function ignitionCamCorr(s: EngineSpec, fRef: number): number {
  const dOverlap = camEvents(s).overlap - IGN_REF_OVERLAP;
  if (dOverlap === 0) return 0;
  const lowRpm = Math.max(0, 0.35 - fRef) / 0.35;
  const highRpm = Math.max(0, fRef - 0.3);
  return dOverlap * (-0.06 * lowRpm + 0.1 * highRpm);
}

export function baseIgnitionDeg(
  s: EngineSpec,
  rpm: number,
  tpsPct: number,
): number {
  const load = clamp(tpsPct / 100, 0, 1);
  const a = ignitionAnchors(s);

  // Scale anchor rpm terhadap spec — pakai rasio ke acuan supaya CR rendah
  // (= pembakaran lambat) menggeser seluruh pltp ke rpm lebih tinggi.
  const scale = a.baseRpm / IGN_REF_BASE_RPM;
  const riseEnd = tableAt(IGN_RISE_END, load) * scale;
  // Peta acuan naik dengan bentuk berbeda per beban: TPS 0 melengkung ke atas
  // (15→18→21→27→33→36, pelan lalu cepat), TPS ≥5 melengkung ke bawah
  // (15→36→39, mendadak lalu datar). Exponent yang berubah dengan beban
  // meniru keduanya; ramp linear menewaskan TPS 0 sebesar 17°.
  const sharp = lerp(1.25, 0.22, clamp(load / 0.05, 0, 1));

  const plateau = tableAt(IGN_PLATEAU, load); // 23 (WOT)..39 (ringan)
  const peak = tableAt(IGN_PEAK, load); // 33 (WOT)..39 (ringan)

  // Posisi rpm dalam rentang yang sudah dikalibrasi. Sengaja tidak memakai
  // redline supaya koreksi cam bebas dari artefak limiter.
  const fRef = (rpm - a.baseRpm) / Math.max(a.dropAt - a.baseRpm, 1);

  let adv: number;
  if (rpm <= a.baseRpm)
    adv = 15; // garis dasar cranks/idle
  else if (rpm <= riseEnd)
    adv =
      15 +
      (plateau - 15) *
        Math.pow((rpm - a.baseRpm) / (riseEnd - a.baseRpm), sharp);
  else if (rpm <= a.topStart) adv = plateau;
  else if (rpm <= a.topEnd)
    adv = lerp(plateau, peak, (rpm - a.topStart) / IGN_TOP_SPAN);
  else adv = rpm >= a.dropAt ? peak - 1 : peak;

  // Koreksi spek — inilah yang membuat timing menyesuaikan mesin.
  adv +=
    ignitionKnockCorr(s, load) +
    ignitionCamCorr(s, fRef) +
    (s.ignBaseOffset || 0);

  // Taper di atas batas putaran (ECU bawaan: mundur ~1° setelah limiter)
  const red = Math.max(redlineRPM(s), 2000);
  if (rpm > red) adv -= Math.min(1, ((rpm - red) / red) * 4);

  // Pengaman mutlak. Koreksi di atas sudah menangani CR/oktan/IAT; plafon ini
  // hanya menangkap kombinasi yang benar-benar berbahaya.
  const lowOct = s.octane > 0 && s.octane < 92;
  const cap = load >= 0.8 ? (lowOct ? 28 : 40) : 44;
  return round1(clamp(adv, lowOct ? 6 : 4, cap));
}

// EOI dasar (End of Injection) dalam °BTDC: injeksi berakhir saat klep intake mulai buka
export function baseEoiDeg(s: EngineSpec): number {
  return round1(camEvents(s).ivo + s.injPhaseOffset);
}

// Kolom pertama tabel selalu 1000 (JUKEN_RPM_START) — format JUKEN 5++.
// Idle mesin tidak menggeser posisi kolom grid, supaya paste ke JUKEN tidak bergeser.
export function rpmGrid(s: EngineSpec): number[] {
  const step = Math.max(Math.round(s.rpmStep), 50);
  const idle = JUKEN_RPM_START; // 1000 — format tabel JUKEN
  const top = Math.max(Math.round(s.maxRPM), idle + step);
  const out: number[] = [];
  for (let rpm = idle; rpm <= top + step / 2; rpm += step) out.push(rpm);
  return out;
}

export interface SpecWarning {
  severity: "danger" | "warn" | "ok";
  msg: string;
}

// Guardrail: cek spek terhadap batas fisika & keselamatan, beri saran perbaikan.
// Memakai stats yang dihitung (duty, piston speed, overlap) + aturan tuning umum.
export function validateSpec(s: EngineSpec, stats: EngineStats): SpecWarning[] {
  const w: SpecWarning[] = [];
  const st = stats;

  const push = (sev: SpecWarning["severity"], msg: string) =>
    w.push({ severity: sev, msg });

  // 1. Kecepatan piston
  if (st.maxPistonSpeed > MAX_PISTON_SPEED_RACE) {
    push(
      "danger",
      `Kecepatan piston ${st.maxPistonSpeed} m/s MELEBIHI batas balap 25 m/s — risiko kerusakan ring piston & klep. Turunkan limiter atau perbesar stroke jangan dinaikkan.`,
    );
  } else if (st.maxPistonSpeed > MAX_PISTON_SPEED_SAFE) {
    push(
      "warn",
      `Kecepatan piston ${st.maxPistonSpeed} m/s di atas aman standar 22 m/s — cek baut penguat, conrod, dan piston balap.`,
    );
  }

  // 2. Duty cycle injector
  const worstDuty = Math.max(st.dutyAtPeak, st.dutyAtLimiter);
  if (worstDuty > 0.95) {
    push(
      "danger",
      `Duty cycle ${(worstDuty * 100).toFixed(0)}% — injector WAJIB diganti atau naikkan flow. Duty >80% berisiko stroke pendek & gagal semprot.`,
    );
  } else if (worstDuty > MAX_DUTY) {
    push(
      "warn",
      `Duty cycle ${(worstDuty * 100).toFixed(0)}% di atas acuan aman 85%. Pertimbangkan injector lebih besar atau naikan tekanan.`,
    );
  }
  if (st.dutyAtPeak > 0 && st.injInstalledCC < st.injRequiredPer) {
    push(
      "warn",
      `Injector terpasang ${st.injInstalledCC} cc/min < butuh ${st.injRequiredPer} cc/min — kurangi aliran atau ganti injector lebih besar.`,
    );
  }

  // 3. Overlap noken
  const ov = st.cam.overlap;
  if (ov < 0)
    push(
      "danger",
      `Overlap noken NEGATIF (${ov}°). Cek angka buka/tutup — cam intake & exhaust kemungkinan salah arah.`,
    );
  else if (s.octane < 95 && ov > 60)
    push(
      "warn",
      `Overlap besar ${ov}° tapi oktan ${s.octane} — risiko valvetrain & detonasi di low-rpm.`,
    );
  else if (ov > 85)
    push(
      "warn",
      `Overlap ${ov}° sangat besar — idle akan kasar, butuh AFR idle lebih kaya.`,
    );

  // 4. Kompresi vs oktan
  if (s.compressionRatio > 13.5 && s.octane < 98)
    push(
      "warn",
      `CR ${s.compressionRatio} tinggi utk oktan ${s.octane} — wajib RON 98+ atau turunkan piston.`,
    );
  else if (s.compressionRatio > 0 && s.compressionRatio < 11 && s.octane > 92)
    push(
      "warn",
      `CR ${s.compressionRatio} rendah — oktan ${s.octane} mubazir; penurunan timing terlalu lambat.`,
    );

  // 5. Limiter vs tabel
  const red = redlineRPM(s);
  if (s.limiterRPM > 0 && red > s.maxRPM)
    push(
      "warn",
      `Limiter ${red} rpm melebihi tinggi tabel ${s.maxRPM} rpm — kolom di atas tidak ada di JUKEN.`,
    );

  // 6. Masukan kosong (Setup Umum)
  if (!s.boreMM || !s.strokeMM)
    push(
      "warn",
      `Bore/stroke belum diisi — isi spek dulu supaya hitungan akurat.`,
    );
  if (!s.injectorFlowCC)
    push(
      "warn",
      `Flow injector belum diisi — Base Map akan 0 ms tanpa spek injector.`,
    );

  if (w.length === 0)
    push(
      "ok",
      "Spek terlihat konsisten. Tetap kalibrasi final dengan AFR meter/dyno.",
    );
  return w;
}

// --- Meta field spek untuk UI Setup ---
// Semua field di bawah ikut diperhitungkan dalam Base Map / Ignition / Injector Timing.
export interface SpecFieldMeta {
  label: string;
  isMap: boolean; // dipakai hitung map
  reason: string;
}

export const SPEC_FIELDS: Record<keyof EngineSpec, SpecFieldMeta> = {
  name: { label: "Nama Setup", isMap: false, reason: "Label saja" },
  boreMM: { label: "Bore", isMap: true, reason: "Volume silinder → Base Map" },
  strokeMM: {
    label: "Stroke",
    isMap: true,
    reason: "Volume silinder → Base Map & kecepatan piston",
  },
  cylinders: {
    label: "Silinder",
    isMap: true,
    reason: "Volume total → Base Map",
  },
  engineType: {
    label: "Tipe Mesin",
    isMap: false,
    reason: "Hanya suara idle — tidak memengaruhi map",
  },
  oversizeMM: {
    label: "Over Size",
    isMap: true,
    reason: "Bore asli → volume → Base Map",
  },
  compressionRatio: {
    label: "Rasio Kompresi",
    isMap: true,
    reason: "Timing Ignition & volume burni",
  },
  intakeIVO: {
    label: "IN Buka",
    isMap: true,
    reason: "Durasi cam → puncak torsi, EOI, ignition",
  },
  intakeIVC: {
    label: "IN Tutup",
    isMap: true,
    reason: "Durasi cam → puncak torsi",
  },
  exhaustEVO: {
    label: "EX Buka",
    isMap: true,
    reason: "Durasi cam → puncak torsi",
  },
  exhaustEVC: {
    label: "EX Tutup",
    isMap: true,
    reason: "Durasi cam & overlap → puncak torsi, ignition",
  },
  injectorFlowCC: {
    label: "Flow Injektor",
    isMap: true,
    reason: "Base Map & duty cycle",
  },
  injectorCount: {
    label: "Jumlah Injektor",
    isMap: true,
    reason: "Base Map per injector",
  },
  fuelPressureBar: {
    label: "Tekanan Bensin",
    isMap: true,
    reason: "Flow nyata injector → Base Map",
  },
  injectorDeadTime: {
    label: "Dead Time",
    isMap: true,
    reason: "Offset durasi injeksi → Base Map",
  },
  veMax: { label: "VE Maks", isMap: true, reason: "Aliran udara → Base Map" },
  altitudeM: {
    label: "Ketinggian",
    isMap: true,
    reason: "Densitas udara → Base Map",
  },
  airTempC: {
    label: "Suhu Intake",
    isMap: true,
    reason: "Densitas udara → Base Map",
  },
  exhaustP1MM: {
    label: "Header P1",
    isMap: true,
    reason: "Puncak torsi & posisi powerband",
  },
  exhaustOutletMM: {
    label: "Outlet Knalpot",
    isMap: true,
    reason: "Taper megaphone → puncak torsi",
  },
  octane: { label: "Oktan", isMap: true, reason: "Timing Ignition" },
  injPhaseOffset: {
    label: "Offset Fase Injeksi",
    isMap: true,
    reason: "Sudut EOI n Timing",
  },
  ignBaseOffset: {
    label: "Offset Bacaan Ignition",
    isMap: true,
    reason: "Timing Ignition",
  },
  afrIdle: {
    label: "AFR Idle",
    isMap: true,
    reason: "Target Base Map zona idle",
  },
  afrCruise: {
    label: "AFR Cruising",
    isMap: true,
    reason: "Target Base Map zona menjelajah",
  },
  afrAccel: {
    label: "AFR Akselerasi",
    isMap: true,
    reason: "Target Base Map zona menengah",
  },
  afrWot: {
    label: "AFR WOT",
    isMap: true,
    reason: "Target Base Map zona beban penuh",
  },
  afrWotHigh: {
    label: "AFR WOT Tinggi",
    isMap: true,
    reason: "Target Base Map WOT rpm tinggi",
  },
  maxRPM: {
    label: "Max RPM",
    isMap: true,
    reason: "Tinggi tabel & aliran batas",
  },
  limiterRPM: {
    label: "Limiter RPM",
    isMap: true,
    reason: "Batas putaran → puncak torsi/power, AFR high",
  },
  rpmStep: {
    label: "RPM Step",
    isMap: true,
    reason: "Pola kolom RPM tabel JUKEN",
  },
};

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
  if (!s.boreMM)
    add("boreMM", "0 — hasil Base Map ikut 0. Isi diameter piston.");
  if (!s.strokeMM)
    add("strokeMM", "0 — hasil Base Map ikut 0. Isi langkah piston.");
  if (!s.cylinders) add("cylinders", "0 — volume total 0.");

  // Injector wajib
  if (!s.injectorFlowCC)
    add("injectorFlowCC", "0 — Base Map jadi 0 ms (fallback tanpa injector).");
  if (!s.injectorCount)
    add("injectorCount", "0 — tidak ada injector terhitung.");
  if (!s.fuelPressureBar)
    add(
      "fuelPressureBar",
      "0 — flow injector dianggapkan 0.5 bar (sangat berkurang).",
    );
  if (!s.injectorDeadTime)
    add(
      "injectorDeadTime",
      "0 — PW tanpa dead time berlebih pendek di low rpm.",
    );

  // Udara wajib
  if (!s.veMax) add("veMax", "0 — aliran udara 0 g/s, Base Map 0 ms.");
  if (!s.maxRPM)
    add("maxRPM", "0 — tabel tidak punya tinggi kolom (pakai 16000).");

  // Ignition wajib
  if (!s.compressionRatio)
    add("compressionRatio", "0 — timing ignition tidak terkompensasi CR.");
  if (!s.octane) add("octane", "0 — timing ignition dianggapkan oktan 92.");

  // AFR wajib (0 = pakai acuan bawaan)
  if (!s.afrIdle) add("afrIdle", "0 — pakai acuan bawaan 13.8.");
  if (!s.afrCruise) add("afrCruise", "0 — pakai acuan bawaan 13.8.");
  if (!s.afrAccel) add("afrAccel", "0 — pakai acuan bawaan.");
  if (!s.afrWot) add("afrWot", "0 — pakai acuan bawaan 12.4.");

  // Cam wajib (0 = durasi tidak valid)
  if (!s.intakeIVO && !s.intakeIVC)
    add("intakeIVO", "Buka+tutup intake 0 — durasi cam lenyap.");
  if (!s.exhaustEVO && !s.exhaustEVC)
    add("exhaustEVO", "Buka+tutup exhaust 0 — durasi cam lenyap.");

  // Knalpot wajib
  if (!s.exhaustP1MM)
    add("exhaustP1MM", "0 — puncak torsi/posisi powerband tanpa acuan header.");
  if (!s.exhaustOutletMM)
    add("exhaustOutletMM", "0 — taper megaphone tanpa acuan outlet.");

  return out;
}
