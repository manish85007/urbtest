import { useEffect, useState } from 'react';

export function useLookups(category: string) {
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    import('../api')
      .then(({ dataApi }) => dataApi.lookups(category))
      .then((rows) => setItems(rows.map((r) => ({ id: r.id, label: r.label }))))
      .catch(() => setItems([]));
  }, [category]);

  return items;
}
