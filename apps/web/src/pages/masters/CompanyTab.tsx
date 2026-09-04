import { useEffect, useState } from 'react';
import { dataApi, filesApi, type CompanyProfile } from '../../api';
import { FileUpload } from '../../components/FileUpload';
import { COMPANY } from '../../lib/company';

interface Props {
  onChanged: (msg: string) => void;
}

const empty: CompanyProfile = {
  name: COMPANY.name,
  brand: COMPANY.brand,
  address: '',
  gst: '',
  pan: '',
  cin: '',
  phone: COMPANY.phone,
  email: COMPANY.email,
  wa: COMPANY.wa,
  cpcb: '',
  kspcb: '',
  r2: '',
  logoFileId: null,
};

export function CompanyTab({ onChanged }: Props) {
  const [form, setForm] = useState<CompanyProfile>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataApi
      .company()
      .then((co) => setForm({ ...empty, ...co, pan: co.pan ?? '' }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function patch<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setForm((cur) => ({ ...cur, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await dataApi.saveCompany(form);
      setForm(saved);
      onChanged('Urbeno statutory / letterhead profile saved. Form 6 and MRN use these details.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="dim">Loading company profile…</p>;

  return (
    <div className="card" style={{ marginTop: '.8rem' }}>
      <div className="card-ttl">Urbeno company &amp; letterhead</div>
      <p className="dim" style={{ fontSize: '.84rem', margin: '.35rem 0 .8rem' }}>
        Production statutory details for Urbeno Private Limited. Stored in the backend (
        <span className="mono">company.profile</span>) and printed on Form 6 / MRN. Replace demo values before go-live.
      </p>
      <form className="sub-form" onSubmit={save} style={{ paddingTop: 0, border: 'none' }}>
        <div className="fr2">
          <div className="fg">
            <label htmlFor="co-name">Legal name *</label>
            <input id="co-name" value={form.name} onChange={(e) => patch('name', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-brand">Brand</label>
            <input id="co-brand" value={form.brand} onChange={(e) => patch('brand', e.target.value)} />
          </div>
        </div>
        <div className="fg">
          <label htmlFor="co-addr">Registered / letterhead address *</label>
          <textarea
            id="co-addr"
            value={form.address}
            onChange={(e) => patch('address', e.target.value)}
            required
            rows={3}
          />
        </div>
        <div className="fr2">
          <div className="fg">
            <label htmlFor="co-gst">GSTIN *</label>
            <input
              id="co-gst"
              className="mono"
              value={form.gst}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => patch('gst', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="co-pan">PAN *</label>
            <input
              id="co-pan"
              className="mono"
              value={form.pan}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => patch('pan', e.target.value.toUpperCase())}
              required
              maxLength={10}
            />
          </div>
          <div className="fg">
            <label htmlFor="co-cin">CIN *</label>
            <input
              id="co-cin"
              className="mono"
              value={form.cin}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => patch('cin', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="co-phone">Phone *</label>
            <input id="co-phone" value={form.phone} onChange={(e) => patch('phone', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-email">Public email</label>
            <input id="co-email" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="co-wa">WhatsApp (digits)</label>
            <input id="co-wa" value={form.wa} onChange={(e) => patch('wa', e.target.value)} />
          </div>
        </div>
        <div className="section-hd" style={{ marginTop: '.4rem' }}>
          Authorisations
        </div>
        <div className="fr2">
          <div className="fg">
            <label htmlFor="co-cpcb">CPCB EPR registration *</label>
            <input id="co-cpcb" value={form.cpcb} onChange={(e) => patch('cpcb', e.target.value)} required />
          </div>
          <div className="fg">
            <label htmlFor="co-kspcb">State PCB authorisation *</label>
            <input id="co-kspcb" value={form.kspcb} onChange={(e) => patch('kspcb', e.target.value)} required />
          </div>
        </div>
        <FileUpload
          kind="logo"
          label="Urbeno logo"
          hint="JPEG preferred for Form 6 / MRN · max 2 MB"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          value={form.logoFileId ? [form.logoFileId] : []}
          onChange={(ids) => patch('logoFileId', ids[0] ?? null)}
        />
        {form.logoFileId ? (
          <img className="logo-preview" src={filesApi.url(form.logoFileId, { stream: true })} alt="Urbeno logo preview" />
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn bp" disabled={busy}>
          {busy ? 'Saving…' : 'Save company profile'}
        </button>
      </form>
    </div>
  );
}
