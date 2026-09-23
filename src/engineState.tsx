import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  baseIgnitionDeg,
  baseMapMs,
  defaultSpec,
  emptySpec,
  rpmGrid,
} from './engine';
import type { EngineSpec, Map2D, SetupKey } from './types';
import { TPS_STEPS } from './types';

const STORAGE_KEY = 'mapping-state-v4';

interface MapState {
  baseMap: Map2D; // ms, format JUKEN Base Map
  fuelCorr: Map2D; // %, format JUKEN Fuel Correction
  ignition: Map2D; // °BTDC, format JUKEN Ignition Timing
  injOffset: Map2D; // offset EOI (°) thd baseline, utk tabel Injector Timing
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
  regenBaseMap: () => void;
  resetFuel: () => void;
  resetIgnition: () => void;
  resetInj: () => void;
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
  };
}

function sanitizeProfile(
  raw: Partial<ProfileState> | undefined,
  defaultFactory: () => EngineSpec,
): ProfileState {
  const spec = { ...defaultFactory(), ...(raw?.spec ?? {}) };
  const grid = makeGrid(spec);
  return alignToSpec(
    {
      spec,
      baseMap: raw?.baseMap?.length ? raw.baseMap : grid.baseMap,
      fuelCorr: raw?.fuelCorr?.length ? raw.fuelCorr : grid.fuelCorr,
      ignition: raw?.ignition?.length ? raw.ignition : grid.ignition,
      injOffset: raw?.injOffset?.length ? raw.injOffset : grid.injOffset,
    },
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
  const [state, setState] = useState<AppState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setState(sanitizeState(raw ? (JSON.parse(raw) as Partial<AppState>) : null));
      } catch {
        setState(sanitizeState(null));
      }
    })();
  }, []);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (state) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  // rpmGrid hanya berubah saat spec profil aktif berubah — dipisah supaya referensi
  // stabil dan layar/tab lain tidak ikut re-render saat sel diedit.
  const activeSpec = state?.profiles[state.active].spec;
  const rpms = useMemo(() => (activeSpec ? rpmGrid(activeSpec) : []), [activeSpec]);

  const value = useMemo<EngineContextValue | null>(() => {
    if (!state) return null;
    const profile = state.profiles[state.active];

    const patchProfile = (fn: (p: ProfileState) => ProfileState) =>
      setState((s) => {
        if (!s) return s;
        const p = s.profiles[s.active];
        return { ...s, profiles: { ...s.profiles, [s.active]: fn(p) } };
      });

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
      regenBaseMap: () =>
        patchProfile((p) => ({ ...p, baseMap: makeGrid(p.spec).baseMap })),
      resetFuel: () => patchProfile((p) => ({ ...p, fuelCorr: makeGrid(p.spec).fuelCorr })),
      resetIgnition: () =>
        patchProfile((p) => ({ ...p, ignition: makeGrid(p.spec).ignition })),
      resetInj: () => patchProfile((p) => ({ ...p, injOffset: makeGrid(p.spec).injOffset })),
    };
  }, [state, rpms]);

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
  };
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}