import { useEffect, useState } from 'react';

type LookupItem = { id: string; label: string; rate?: number; description?: string };
const lookupCache = new Map<string, Promise<LookupItem[]>>();

async function fetchLookups(category: string): Promise<LookupItem[]> {
  const cached = lookupCache.get(category);
  if (cached) return cached;
  const p = import('../api')
    .then(({ dataApi }) => dataApi.lookups(category))
    .then((rows) => rows.map((r) => ({ id: r.id, label: r.label, rate: r.rate, description: r.description })))
    .catch(() => [] as LookupItem[]);
  lookupCache.set(category, p);
  return p;
}

export function useLookups(category: string) {
  const [items, setItems] = useState<LookupItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetchLookups(category).then((rows) => {
      if (alive) setItems(rows);
    });
    return () => {
      alive = false;
    };
  }, [category]);

  return items;
}

export function lookupLabel(
  items: Array<{ id: string; label: string }>,
  id?: string | null,
  fallback = '—',
): string {
  if (!id) return fallback;
  return items.find((x) => x.id === id)?.label ?? id;
}
