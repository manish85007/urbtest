import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authApi, type SessionUser } from './api';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { LegalPage } from './pages/LegalPage';
import { AuditPage } from './pages/AuditPage';
import { Shell } from './components/Shell';
import { LegalConsentGate } from './components/LegalConsentGate';

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [legalOk, setLegalOk] = useState(false);
  const [checkingLegal, setCheckingLegal] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setLegalOk(false);
      return;
    }
    setCheckingLegal(true);
    authApi
      .legalStatus()
      .then((s) => setLegalOk(s.compliant))
      .catch(() => setLegalOk(true))
      .finally(() => setCheckingLegal(false));
  }, [user]);

  if (loading) {
    return <div className="center">Loading Urb TecTrack…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/legal/:key" element={<LegalPage />} />
        <Route path="*" element={<LoginPage onLogin={setUser} />} />
      </Routes>
    );
  }

  if (checkingLegal) {
    return <div className="center">Checking policies…</div>;
  }

  if (!legalOk) {
    return <LegalConsentGate onAccepted={() => setLegalOk(true)} />;
  }

  return (
    <Shell user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        <Route path="/requests/new" element={<NewRequestPage user={user} />} />
        <Route path="/requests/:id" element={<SubmissionDetailPage user={user} />} />
        <Route path="/legal/:key" element={<LegalPage />} />
        {user.role === 'admin' ? <Route path="/audit" element={<AuditPage />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
