import { useCallback, useRef, useState } from 'react';
import { copyAll, copyColumn } from './copy';

export function useCopy(ecuRpms: readonly number[]) {
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
      await copyColumn([...ecuRpms], tps, valueAt);
      flash(() => setCopiedTps(tps));
    },
    [ecuRpms],
  );

  const copyAllMap = useCallback(
    async (tps: number[], valueAt: (r: number, c: number) => string) => {
      await copyAll(ecuRpms, tps, valueAt);
      flash(() => setCopiedAll(true));
    },
    [ecuRpms],
  );

  return { copiedTps, copiedAll, copy, copyAllMap };
}
