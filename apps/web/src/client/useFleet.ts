import { useCallback, useRef, useState } from 'react';

export interface FleetEntry {
  id: string;
  az: string;
  hits: number;
  lastSeen: number;
}

const WINDOW_MS = 10_000;

/**
 * Tracks which instances answered us in the last 10 seconds, and how often.
 *
 * This is what makes request distribution observable: when the ASG scales
 * out, a new bar grows from zero while the existing ones shrink.
 */
export function useFleet() {
  const hits = useRef<{ id: string; az: string; at: number }[]>([]);
  const [fleet, setFleet] = useState<FleetEntry[]>([]);

  const record = useCallback((id: string, az: string) => {
    const now = Date.now();
    hits.current.push({ id, az, at: now });
    hits.current = hits.current.filter((h) => now - h.at < WINDOW_MS);

    const byId = new Map<string, FleetEntry>();
    for (const h of hits.current) {
      const e = byId.get(h.id) ?? { id: h.id, az: h.az, hits: 0, lastSeen: 0 };
      e.hits++;
      e.lastSeen = Math.max(e.lastSeen, h.at);
      byId.set(h.id, e);
    }
    setFleet([...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }, []);

  return { fleet, record };
}
