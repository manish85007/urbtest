import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, dataApi, filesApi, type CompanyProfile, type SessionUser } from '../api';
import { FileUpload } from '../components/FileUpload';
import { COMPANY } from '../lib/company';

interface ProfilePageProps {
  user: SessionUser;
}

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: 'Urbeno Admin',
  factory: 'Factory Manager',
  client: 'Client User',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '--';
}

function phoneTel(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    dataApi.company().then(setCompany).catch(() => setCompany(null));
  }, []);

  const support = company ?? {
    name: COMPANY.name,
    brand: COMPANY.brand,
    address: '',
    gst: '',
    cin: '',
    phone: COMPANY.phone,
    email: COMPANY.email,
    wa: COMPANY.wa,
    cpcb: '',
    kspcb: '',
    r2: '',
    logoFileId: null,
  };

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    if (next !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await authApi.changePassword(current, next);
      setMsg('Password updated — use it the next time you sign in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    }
  }

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div className="h1">Your profile</div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="uav" style={{ width: 42, height: 42, fontSize: '.9rem' }}>
                {initials(user.name)}
              </div>
              <div>
                <div className="card-ttl">{user.name}</div>
                <div className="dim" style={{ fontSize: '.8rem' }}>
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '.45rem' }}>
              <div className="tile">
                <div className="tile-l">Email</div>
                <div className="tile-v">{user.email}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Role</div>
                <div className="tile-v">{ROLE_LABEL[user.role]}</div>
              </div>
              {user.clientId ? (
                <div className="tile">
                  <div className="tile-l">Organisation</div>
                  <div className="tile-v">{user.clientId}</div>
                </div>
              ) : null}
              {(user.factoryIds ?? []).length ? (
                <div className="tile">
                  <div className="tile-l">Facilities</div>
                  <div className="tile-v">{user.factoryIds?.join(', ')}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-ttl">Change password</div>
            <form className="sub-form" onSubmit={changePassword} style={{ marginTop: '.6rem', paddingTop: 0, border: 'none' }}>
              <div className="fg">
                <label>Current password</label>
                <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
              <div className="fr2">
                <div className="fg">
                  <label>New password</label>
                  <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} />
                </div>
                <div className="fg">
                  <label>Confirm new password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={4} />
                </div>
              </div>
              {msg ? <p className="ok-msg">{msg}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn bp">
                Update password
              </button>
            </form>
          </div>

          {user.role === 'admin' ? (
            <CompanyLetterheadForm
              initial={company}
              onSaved={(nextCo) => {
                setCompany(nextCo);
                setMsg('Urbeno letterhead saved — Form 6 and MRN will use these details.');
              }}
            />
          ) : null}
        </div>
        <div>
          <div className="card">
            <div className="card-ttl">{support.name}</div>
            {support.logoFileId ? (
              <img
                className="logo-preview"
                src={filesApi.url(support.logoFileId)}
                alt={`${support.name} logo`}
                style={{ maxHeight: 56, margin: '.4rem 0 .6rem' }}
              />
            ) : null}
            <p className="dim" style={{ fontSize: '.85rem', margin: '.5rem 0' }}>
              {support.address || 'Letterhead address is set by Urbeno admin on this page.'}
            </p>
            <div style={{ fontSize: '.84rem', lineHeight: 1.7 }}>
              {support.gst ? <div>GST {support.gst}</div> : null}
              {support.cin ? <div>CIN {support.cin}</div> : null}
              <div>
                📞{' '}
                <a href={`tel:${phoneTel(support.phone)}`} style={{ color: 'var(--g)' }}>
                  {support.phone}
                </a>
              </div>
              <div>
                ✉️{' '}
                <a href={`mailto:${support.email}`} style={{ color: 'var(--g)' }}>
                  {support.email}
                </a>
              </div>
              <div>
                💬{' '}
                <a
                  href={`https://wa.me/${support.wa || COMPANY.wa}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--g)' }}
                >
                  WhatsApp support
                </a>
              </div>
            </div>
            <div style={{ marginTop: '.8rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Link to="/legal/terms">Terms of Use</Link>
              <Link to="/legal/privacy">Privacy &amp; Data</Link>
              <Link to="/legal/support">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyLetterheadForm({
  initial,
  onSaved,
}: {
  initial: CompanyProfile | null;
  onSaved: (co: CompanyProfile) => void;
}) {
  const [form, setForm] = useState<CompanyProfile>(
    initial ?? {
      name: COMPANY.name,
      brand: COMPANY.brand,
      address: '',
      gst: '',
      cin: '',
      phone: COMPANY.phone,
      email: COMPANY.email,
      wa: COMPANY.wa,
      cpcb: '',
      kspcb: '',
      r2: '',
      logoFileId: null,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  function patch<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await dataApi.saveCompany(form);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save letterhead.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-ttl">Urbeno letterhead</div>
      <p className="dim" style={{ fontSize: '.82rem', margin: '.35rem 0 .7rem' }}>
        These details and the logo print on Form 6 and MRN documents.
      </p>
      <form className="sub-form" onSubmit={save} style={{ paddingTop: 0, border: 'none' }}>
        <div className="fr2">
          <div className="fg">
            <label htmlFor="co-name">Legal name</label>
            <input id="co-name" value={form.name} onChange={(e) => patch('name', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-brand">Brand</label>
            <input id="co-brand" value={form.brand} onChange={(e) => patch('brand', e.target.value)} />
          </div>
        </div>
        <div className="fg">
          <label htmlFor="co-addr">Complete address</label>
          <textarea
            id="co-addr"
            value={form.address}
            onChange={(e) => patch('address', e.target.value)}
            required
            rows={3}
            placeholder="Registered office / facility address as it should appear on the letterhead"
          />
        </div>
        <div className="fr2">
          <div className="fg">
            <label htmlFor="co-gst">GSTIN</label>
            <input id="co-gst" value={form.gst} onChange={(e) => patch('gst', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-cin">CIN</label>
            <input id="co-cin" value={form.cin} onChange={(e) => patch('cin', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-phone">Phone</label>
            <input id="co-phone" value={form.phone} onChange={(e) => patch('phone', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-email">Email</label>
            <input id="co-email" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="co-wa">WhatsApp (digits)</label>
            <input id="co-wa" value={form.wa} onChange={(e) => patch('wa', e.target.value)} placeholder="919902299007" />
          </div>
        </div>
        <FileUpload
          kind="logo"
          label="Urbeno logo"
          hint="JPEG preferred for Form 6 / MRN letterhead · max 2 MB"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          value={form.logoFileId ? [form.logoFileId] : []}
          onChange={(ids) => patch('logoFileId', ids[0] ?? null)}
        />
        {form.logoFileId ? (
          <img className="logo-preview" src={filesApi.url(form.logoFileId)} alt="Urbeno logo preview" />
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn bp" disabled={busy}>
          Save letterhead
        </button>
      </form>
    </div>
  );
}
