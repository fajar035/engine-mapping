import { useCallback, useRef, useState } from 'react';
import { copyAll, copyColumn } from './copy';

export function useCopy(rpms: number[]) {
  const [copiedTps, setCopiedTps] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    fn();
    timer.current = setTimeout(() => {
      setCopiedTps(null);
      setCopiedAll(false);
    }, 1600);
  };

  const copy = useCallback(
    async (tps: number, valueAt: (i: number) => string) => {
      await copyColumn(rpms, tps, valueAt);
      flash(() => setCopiedTps(tps));
    },
    [rpms],
  );

  const copyAllMap = useCallback(
    async (tps: number[], valueAt: (r: number, c: number) => string) => {
      await copyAll(rpms, tps, valueAt);
      flash(() => setCopiedAll(true));
    },
    [rpms],
  );

  return { copiedTps, copiedAll, copy, copyAllMap };
}