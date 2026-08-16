import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataApi } from '../api';

export function GlobalSearch() {
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Array<{ grp: string; label: string; sub: string; href: string }>>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      dataApi
        .search(q)
        .then((rows) => {
          setHits(rows);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const groups = hits.reduce<Record<string, typeof hits>>((acc, h) => {
    (acc[h.grp] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="srch" ref={box}>
      <input
        type="text"
        value={q}
        placeholder="Search anything — ID, serial, invoice, CoD, MRN…"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (q.trim().length >= 2) setOpen(true);
        }}
      />
      {open ? (
        <div className="sres">
          {hits.length === 0 ? (
            <div style={{ padding: '.8rem', textAlign: 'center', color: 'var(--mu)', fontSize: '.85rem' }}>
              No matches for “{q}”
            </div>
          ) : (
            Object.entries(groups).map(([grp, items]) => (
              <div key={grp}>
                <div className="sres-g">{grp}</div>
                {items.map((i) => (
                  <button
                    key={`${i.grp}-${i.label}-${i.href}`}
                    type="button"
                    className="sres-i"
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', font: 'inherit' }}
                    onClick={() => {
                      setQ('');
                      setOpen(false);
                      nav(i.href);
                    }}
                  >
                    <b>{i.label}</b>
                    <div className="dim" style={{ fontSize: '.75rem' }}>
                      {i.sub}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
