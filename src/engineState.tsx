import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  baseIgnitionDeg,
  baseMapMs,
  calibrationCorrPct,
  defaultSpec,
  emptySpec,
  rpmGrid,
} from './engine';
import type { EngineSpec, Map2D, SetupKey } from './types';
import { TPS_STEPS } from './types';

// Versi lama grid TPS menyertakan 95% yang ternyata TIDAK ada di JUKEN 5++.
// Untuk migrasi data lama (22 baris) ke grid baru (21 baris), baris dipetakan
// berdasarkan nilai TPS agar tidak bergeser satu tingkat saat di-paste ke JUKEN.
const LEGACY_TPS: readonly number[] = [
  0, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];

interface MapState {
  baseMap: Map2D; // ms, format JUKEN Base Map
  fuelCorr: Map2D; // %, format JUKEN Fuel Correction
  ignition: Map2D; // °BTDC, format JUKEN Ignition Timing
  injOffset: Map2D; // offset EOI (°) thd baseline, utk tabel Injector Timing
  afrMeasured: Map2D; // AFR terukur dari AFR meter (0 = kosong), utk Kalibrasi
}

interface ProfileState extends MapState {
  spec: EngineSpec;
}

interface AppState {
  active: SetupKey;
  profiles: {
    motor: ProfileState;
    umum: ProfileState;
  };
}

// Riwayat undo untuk edit grid (per profil). Snapshot di-push SEBELUM setiap
// mutasi grid (ref, tidak ikut tersimpan ke disk karena berulang 30× dan besar).
interface HistEntry {
  k: SetupKey;
  maps: MapState;
}

const MAX_HISTORY = 30;

interface EngineContextValue extends ProfileState {
  rpms: number[];
  loaded: boolean;
  active: SetupKey;
  setActive: (k: SetupKey) => void;
  updateSpec: (patch: Partial<EngineSpec>) => void;
  setBaseMap: (r: number, c: number, v: number) => void;
  setFuel: (r: number, c: number, v: number) => void;
  setIgnition: (r: number, c: number, v: number) => void;
  setInjOffset: (r: number, c: number, v: number) => void;
  setAfrMeasured: (r: number, c: number, v: number) => void;
  clearAfrMeasured: () => void;
  applyCalibration: () => number; // terapkan koreksi AFR→ fuelCorr; kembalikan jml sel
  regenBaseMap: () => void;
  resetFuel: () => void;
  resetIgnition: () => void;
  resetInj: () => void;
  undo: () => void;
  canUndo: boolean;
  undoDepth: number;
}

const EngineContext = createContext<EngineContextValue | null>(null);

// Grid disimpan sebagai [baris TPS][kolom RPM] — mengikuti tampilan app JUKEN
// (TPS di kiri, RPM di atas). TPS_STEPS.length baris × rpmGrid(spec).length kolom.
function fillBaseMap(spec: EngineSpec, map: Map2D): Map2D {
  const rpms = rpmGrid(spec);
  return map.map((tpsRow, j) =>
    tpsRow.map((_, i) => baseMapMs(spec, rpms[i], TPS_STEPS[j])),
  );
}

function fillIgnition(spec: EngineSpec, map: Map2D): Map2D {
  const rpms = rpmGrid(spec);
  return map.map((tpsRow, j) =>
    tpsRow.map((_, i) => baseIgnitionDeg(spec, rpms[i], TPS_STEPS[j])),
  );
}

function makeGrid(spec: EngineSpec): MapState {
  const rows = TPS_STEPS.length; // baris TPS
  const cols = rpmGrid(spec).length; // kolom RPM
  const empty = () =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  return {
    baseMap: fillBaseMap(spec, empty()),
    fuelCorr: empty(),
    ignition: fillIgnition(spec, empty()),
    injOffset: empty(),
    afrMeasured: empty(),
  };
}

function sanitizeProfile(
  raw: Partial<ProfileState> | undefined,
  defaultFactory: () => EngineSpec,
): ProfileState {
  const spec = { ...defaultFactory(), ...(raw?.spec ?? {}) };
  const grid = makeGrid(spec);
  // Migrasi grid lama (22 TPS, termasuk 95) → 21 TPS: petakan baris berdasarkan
  // nilai TPS, bukan posisi, supaya data TPS 100 tidak salah jadi TPS 95.
  const migrate = (m: Map2D): Map2D => {
    if (m.length !== LEGACY_TPS.length) return m;
    return TPS_STEPS.map((t) => {
      const i = LEGACY_TPS.indexOf(t);
      return i >= 0 ? m[i] : undefined;
    }).filter((r): r is number[] => !!r);
  };
  const baseMap = migrate(raw?.baseMap?.length ? raw.baseMap : grid.baseMap);
  const fuelCorr = migrate(raw?.fuelCorr?.length ? raw.fuelCorr : grid.fuelCorr);
  const ignition = migrate(raw?.ignition?.length ? raw.ignition : grid.ignition);
  const injOffset = migrate(raw?.injOffset?.length ? raw.injOffset : grid.injOffset);
  const afrMeasured = migrate(
    raw?.afrMeasured?.length ? raw.afrMeasured : grid.afrMeasured,
  );
  return alignToSpec(
    { spec, baseMap, fuelCorr, ignition, injOffset, afrMeasured },
    spec,
  );
}

function sanitizeState(raw: Partial<AppState> | null): AppState {
  const hasProfiles = !!raw?.profiles?.motor || !!raw?.profiles?.umum;
  return {
    active: hasProfiles && raw?.active ? raw.active : 'motor',
    profiles: {
      motor: sanitizeProfile(
        hasProfiles ? raw?.profiles?.motor : (raw as Partial<ProfileState> | undefined),
        defaultSpec,
      ),
      umum: sanitizeProfile(raw?.profiles?.umum, emptySpec),
    },
  };
}

export function EngineProvider({ children }: { children: React.ReactNode }) {
  // Setiap buka/reload selalu mulai dari spek default bawaan — data lama tidak
  // dibaca, supaya tidak ada perubahan diam-diam dari nilai default baru.
  const [state, setState] = useState<AppState | null>(() => sanitizeState(null));

  // rpmGrid hanya berubah saat spec profil aktif berubah — dipisah supaya referensi
  // stabil dan layar/tab lain tidak ikut re-render saat sel diedit.
  const activeSpec = state?.profiles[state.active].spec;
  const rpms = useMemo(() => (activeSpec ? rpmGrid(activeSpec) : []), [activeSpec]);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const snapshot = (p: ProfileState): MapState => ({
    baseMap: p.baseMap,
    fuelCorr: p.fuelCorr,
    ignition: p.ignition,
    injOffset: p.injOffset,
    afrMeasured: p.afrMeasured,
  });

  const value = useMemo<EngineContextValue | null>(() => {
    if (!state) return null;
    const profile = state.profiles[state.active];

    // push snapshot SEBELUM mutasi (dipanggil dari evbent handler, bukan render)
    const pushHistory = () =>
      setHistory((h) =>
        [...h, { k: state.active, maps: snapshot(profile) }].slice(-MAX_HISTORY),
      );

    const patchProfile = (fn: (p: ProfileState) => ProfileState) => {
      pushHistory();
      setState((s) => {
        if (!s) return s;
        const p = s.profiles[s.active];
        return { ...s, profiles: { ...s.profiles, [s.active]: fn(p) } };
      });
    };

    const undo = () => {
      for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.k === state.active) {
          setState((s) => {
            if (!s) return s;
            const p = s.profiles[e.k];
            return { ...s, profiles: { ...s.profiles, [e.k]: { ...p, ...e.maps } } };
          });
          setHistory((h) => h.slice(0, i));
          return;
        }
      }
    };

    const updateSpec = (patch: Partial<EngineSpec>) =>
      patchProfile((p) => {
        const spec = { ...p.spec, ...patch };
        const changeRows = rpmGrid(spec).length !== rpmGrid(p.spec).length;
        return changeRows ? alignToSpec({ ...p, spec }, spec) : { ...p, spec };
      });

    const setBaseMap = (r: number, c: number, v: number) =>
      patchProfile((p) => ({ ...p, baseMap: setCell(p.baseMap, r, c, v) }));
    const setFuel = (r: number, c: number, v: number) =>
      patchProfile((p) => ({ ...p, fuelCorr: setCell(p.fuelCorr, r, c, v) }));
    const setIgnition = (r: number, c: number, v: number) =>
      patchProfile((p) => ({ ...p, ignition: setCell(p.ignition, r, c, v) }));
    const setInjOffset = (r: number, c: number, v: number) =>
      patchProfile((p) => ({ ...p, injOffset: setCell(p.injOffset, r, c, v) }));
    const setAfrMeasured = (r: number, c: number, v: number) =>
      patchProfile((p) => ({
        ...p,
        afrMeasured: setCell(p.afrMeasured, r, c, v),
      }));
    const clearAfrMeasured = () =>
      patchProfile((p) => ({ ...p, afrMeasured: makeGrid(p.spec).afrMeasured }));

    // Terapkan koreksi AFR terukur ke Fuel Correction: utk tiap sel dengan AFR
    // terukur, hitung koreksi % agar jadi target dan tulis ke fuelCorr.
    const applyCalibration = () => {
      let applied = 0;
      for (const row of profile.afrMeasured) {
        for (const v of row) if (v > 0) applied++;
      }
      patchProfile((p) => {
        const rpx = rpmGrid(p.spec);
        const next = p.fuelCorr.map((row, j) =>
          row.map((v, i) => {
            const m = p.afrMeasured[j]?.[i] ?? 0;
            return m > 0 ? calibrationCorrPct(p.spec, rpx[i], TPS_STEPS[j], m) : v;
          }),
        );
        return { ...p, fuelCorr: next };
      });
      return applied;
    };

    return {
      ...profile,
      rpms,
      loaded: true,
      active: state.active,
      setActive: (k) => setState((s) => (s ? { ...s, active: k } : s)),
      updateSpec,
      setBaseMap,
      setFuel,
      setIgnition,
      setInjOffset,
      setAfrMeasured,
      clearAfrMeasured,
      applyCalibration,
      regenBaseMap: () =>
        patchProfile((p) => ({ ...p, baseMap: makeGrid(p.spec).baseMap })),
      resetFuel: () => patchProfile((p) => ({ ...p, fuelCorr: makeGrid(p.spec).fuelCorr })),
      resetIgnition: () =>
        patchProfile((p) => ({ ...p, ignition: makeGrid(p.spec).ignition })),
      resetInj: () => patchProfile((p) => ({ ...p, injOffset: makeGrid(p.spec).injOffset })),
      undo,
      canUndo: history.some((e) => e.k === state.active),
      undoDepth: history.filter((e) => e.k === state.active).length,
    };
  }, [state, rpms, history]);

  if (!value) {
    return <React.Fragment />;
  }

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

function setCell(map: Map2D, r: number, c: number, v: number): Map2D {
  // Hanya baris yang berubah yang dibuat baru — baris lain mempertahankan referensi
  // supaya lapisan grid (React.memo) bisa skip re-render baris yang tidak berubah.
  const next = map.slice();
  if (next[r]) {
    next[r] = map[r].slice();
    next[r][c] = v;
  }
  return next;
}

// Samakan jumlah baris (TPS) & kolom (RPM) dengan grid saat ini.
// Baris/sel yang sudah ada dipertahankan; kekurangannya diisi dari baseline baru.
function resizeMap(
  map: Map2D,
  nRows: number,
  nCols: number,
  defRow: (i: number) => number[],
): Map2D {
  const out: Map2D = [];
  for (let i = 0; i < nRows; i++) {
    const src = map[i] ?? defRow(i);
    const row = src.slice(0, nCols);
    while (row.length < nCols) row.push(defRow(i)[row.length]);
    out.push(row);
  }
  return out;
}

function alignToSpec(profile: ProfileState, spec: EngineSpec): ProfileState {
  const n = TPS_STEPS.length;
  const m = rpmGrid(spec).length;
  const def = makeGrid(spec);
  return {
    ...profile,
    spec,
    baseMap: resizeMap(profile.baseMap, n, m, (i) => def.baseMap[i]),
    fuelCorr: resizeMap(profile.fuelCorr, n, m, (i) => def.fuelCorr[i]),
    ignition: resizeMap(profile.ignition, n, m, (i) => def.ignition[i]),
    injOffset: resizeMap(profile.injOffset, n, m, (i) => def.injOffset[i]),
    afrMeasured: resizeMap(profile.afrMeasured, n, m, (i) => def.afrMeasured[i]),
  };
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}