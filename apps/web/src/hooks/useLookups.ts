import { useEffect, useState } from 'react';

export function useLookups(category: string) {
  const [items, setItems] = useState<Array<{ id: string; label: string; rate?: number; description?: string }>>([]);

  useEffect(() => {
    import('../api')
      .then(({ dataApi }) => dataApi.lookups(category))
      .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: r.label, rate: r.rate, description: r.description }))))
      .catch(() => setItems([]));
  }, [category]);

  return items;
}
