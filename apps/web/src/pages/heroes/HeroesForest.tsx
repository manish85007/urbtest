import { useMemo, useState } from 'react';
import type { HeroesPlanting } from '../../api';

export type ForestFilter = 'all' | 'urbeno' | 'client' | 'pending';

export interface TreeInstance {
  id: string;
  source: 'urbeno' | 'client' | 'pending';
  plantingId?: string;
  label: string;
  detail?: string;
}

interface HeroesForestProps {
  plantings: HeroesPlanting[];
  byUrbeno: number;
  byClient: number;
  owed: number;
  plantedAll: number;
  filter: ForestFilter;
  selectedPlantingId: string | null;
  onSelectPlanting: (plantingId: string | null) => void;
}

const MAX_TREES = 72;

function seedFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildInstances(
  plantings: HeroesPlanting[],
  byUrbeno: number,
  byClient: number,
  owed: number,
): TreeInstance[] {
  const out: TreeInstance[] = [];
  let urbenoLeft = byUrbeno;
  let clientLeft = byClient;

  for (const p of plantings) {
    const src = p.source === 'client' ? 'client' : 'urbeno';
    for (let i = 0; i < p.trees; i++) {
      if (src === 'urbeno' && urbenoLeft <= 0) continue;
      if (src === 'client' && clientLeft <= 0) continue;
      if (src === 'urbeno') urbenoLeft--;
      else clientLeft--;

      out.push({
        id: `${p.id}-${i}`,
        source: src,
        plantingId: p.id,
        label: src === 'client' ? 'Your CSR tree' : 'Urbeno tree',
        detail: [p.location, p.species].filter(Boolean).join(' · ') || p.partner || undefined,
      });
    }
  }

  while (urbenoLeft > 0) {
    out.push({
      id: `urbeno-extra-${urbenoLeft}`,
      source: 'urbeno',
      label: 'Urbeno tree',
    });
    urbenoLeft--;
  }
  while (clientLeft > 0) {
    out.push({
      id: `client-extra-${clientLeft}`,
      source: 'client',
      label: 'Your CSR tree',
    });
    clientLeft--;
  }

  for (let i = 0; i < owed; i++) {
    out.push({
      id: `pending-${i}`,
      source: 'pending',
      label: 'Earned — planting soon',
      detail: 'Scheduled for the next Urbeno drive',
    });
  }

  return out;
}

function TreeSvg({ source, selected }: { source: TreeInstance['source']; selected: boolean }) {
  const isPending = source === 'pending';
  const isClient = source === 'client';
  const trunk = isClient ? '#7c3aed' : '#92400e';
  const canopy = isPending ? '#86efac' : isClient ? '#a78bfa' : '#22c55e';
  const canopyDark = isPending ? '#4ade80' : isClient ? '#7c3aed' : '#15803d';

  return (
    <svg viewBox="0 0 48 64" className="heroes-tree-svg" aria-hidden>
      {!isPending ? (
        <>
          <ellipse cx="24" cy="58" rx="10" ry="3" fill="rgba(0,0,0,.08)" />
          <rect x="21" y="38" width="6" height="18" rx="2" fill={trunk} />
          <circle cx="24" cy="26" r="16" fill={canopy} className="heroes-tree-canopy" />
          <circle cx="16" cy="30" r="10" fill={canopyDark} opacity=".55" />
          <circle cx="32" cy="28" r="9" fill={canopyDark} opacity=".45" />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="58" rx="8" ry="2.5" fill="rgba(0,0,0,.06)" />
          <rect x="22.5" y="44" width="3" height="12" rx="1" fill="#a3a3a3" />
          <path
            d="M24 44 C18 38 14 34 24 28 C34 34 30 38 24 44"
            fill="none"
            stroke={canopy}
            strokeWidth="2"
            strokeDasharray="3 2"
            className="heroes-sapling-leaf"
          />
          <circle cx="24" cy="26" r="5" fill={canopy} opacity=".7" className="heroes-sapling-top" />
        </>
      )}
      {selected ? <circle cx="24" cy="32" r="22" fill="none" stroke="#fbbf24" strokeWidth="2" opacity=".85" /> : null}
    </svg>
  );
}

export function HeroesForest({
  plantings,
  byUrbeno,
  byClient,
  owed,
  plantedAll,
  filter,
  selectedPlantingId,
  onSelectPlanting,
}: HeroesForestProps) {
  const [hovered, setHovered] = useState<TreeInstance | null>(null);

  const allInstances = useMemo(
    () => buildInstances(plantings, byUrbeno, byClient, owed),
    [plantings, byUrbeno, byClient, owed],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return allInstances;
    return allInstances.filter((t) => t.source === filter);
  }, [allInstances, filter]);

  const visible = filtered.slice(0, MAX_TREES);
  const hidden = Math.max(0, filtered.length - MAX_TREES);
  const totalStanding = plantedAll;

  return (
    <div className="heroes-forest-wrap">
      <div className="heroes-forest-sky">
        <div className="heroes-cloud heroes-cloud-a" />
        <div className="heroes-cloud heroes-cloud-b" />
        <div className="heroes-sun" />
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="heroes-co2-bubble" style={{ left: `${12 + i * 14}%`, animationDelay: `${i * 1.1}s` }}>
            CO₂
          </span>
        ))}
      </div>

      <div className="heroes-forest-ground">
        <div className="heroes-forest-hills" />
        <div className="heroes-tree-field" role="list" aria-label={`${totalStanding} trees in your forest`}>
          {visible.length === 0 ? (
            <div className="heroes-forest-empty">
              <span className="heroes-forest-empty-ico">🌱</span>
              <p>No trees in this view yet — recycle more to grow your forest.</p>
            </div>
          ) : (
            visible.map((tree, i) => {
              const seed = seedFromId(tree.id);
              const sway = (seed % 7) * 0.15 + 0.85;
              const scale = tree.source === 'pending' ? 0.72 + (seed % 3) * 0.04 : 0.88 + (seed % 5) * 0.05;
              const selected = tree.plantingId != null && tree.plantingId === selectedPlantingId;

              return (
                <button
                  key={tree.id}
                  type="button"
                  role="listitem"
                  className={`heroes-tree-btn heroes-tree-${tree.source}${selected ? ' selected' : ''}`}
                  style={{
                    animationDelay: `${(i % 12) * 0.08}s`,
                    ['--sway-duration' as string]: `${2.8 + (seed % 5) * 0.4}s`,
                    ['--tree-scale' as string]: String(scale),
                    ['--sway-amp' as string]: `${sway}deg`,
                  }}
                  onClick={() => onSelectPlanting(selected ? null : tree.plantingId ?? null)}
                  onMouseEnter={() => setHovered(tree)}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={tree.label}
                >
                  <TreeSvg source={tree.source} selected={selected} />
                </button>
              );
            })
          )}
        </div>
        {hidden > 0 ? (
          <div className="heroes-forest-more">+{hidden} more tree{hidden > 1 ? 's' : ''} in this view</div>
        ) : null}
      </div>

      {hovered ? (
        <div className="heroes-tree-tooltip" role="tooltip">
          <strong>{hovered.label}</strong>
          {hovered.detail ? <span>{hovered.detail}</span> : null}
          {hovered.plantingId ? <em>Click to jump to planting record</em> : null}
        </div>
      ) : null}

      <div className="heroes-forest-legend">
        <span><i className="dot urbeno" /> Urbeno ({byUrbeno})</span>
        <span><i className="dot client" /> Your CSR ({byClient})</span>
        {owed > 0 ? <span><i className="dot pending" /> Scheduled ({owed})</span> : null}
      </div>
    </div>
  );
}
