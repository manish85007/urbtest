import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataApi } from '../api';

export function NotificationBell() {
  const nav = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<
    Array<{ id: string; text: string; link: string | null; read: boolean; createdAt: string }>
  >([]);

  async function load() {
    try {
      const data = await dataApi.notifications();
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      setUnread(0);
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        type="button"
        className="nbell"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        🔔
        {unread > 0 ? <span className="ndot">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="npanel">
          <div
            style={{
              padding: '.5rem .7rem',
              borderBottom: '1px solid var(--bd)',
              display: 'flex',
              alignItems: 'center',
              gap: '.5rem',
            }}
          >
            <b style={{ fontSize: '.85rem' }}>Notifications</b>
            <div className="spacer" />
            <button
              type="button"
              className="btn bs bsm"
              onClick={async () => {
                await dataApi.markAllNotificationsRead();
                await load();
              }}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '1.4rem', textAlign: 'center', color: 'var(--mu)', fontSize: '.85rem' }}>
              Nothing yet
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`nitem ${n.read ? '' : 'unread'}`}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', font: 'inherit' }}
                onClick={async () => {
                  await dataApi.markNotificationRead(n.id);
                  setOpen(false);
                  if (n.link) nav(n.link.startsWith('/') ? n.link : `/requests/${n.link}`);
                  await load();
                }}
              >
                <div>{n.text}</div>
                <div className="dim" style={{ fontSize: '.7rem', marginTop: '.15rem' }}>
                  {n.createdAt.slice(0, 16).replace('T', ' ')}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
