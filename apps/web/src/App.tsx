import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { authApi, type SessionUser } from './api';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestsListPage } from './pages/RequestsListPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { SubmissionDetailPage } from './pages/SubmissionDetailPage';
import { LegalPage } from './pages/LegalPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImpactPage } from './pages/ImpactPage';
import { HeroesPage } from './pages/HeroesPage';
import { CapacityPage } from './pages/CapacityPage';
import { MastersPage } from './pages/MastersPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { CompliancePage } from './pages/CompliancePage';
import { Shell } from './components/Shell';
import { LegalConsentGate } from './components/LegalConsentGate';

function StaffOnly({ user, children }: { user: SessionUser; children: ReactNode }) {
  if (user.role === 'client') return <Navigate to="/" replace />;
  return children;
}

function AdminOnly({ user, children }: { user: SessionUser; children: ReactNode }) {
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

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
        <Route path="/requests" element={<RequestsListPage user={user} />} />
        <Route path="/requests/new" element={<NewRequestPage user={user} />} />
        <Route path="/requests/:id" element={<SubmissionDetailPage user={user} />} />
        <Route path="/reports" element={<ReportsPage user={user} />} />
        <Route path="/heroes" element={<HeroesPage user={user} />} />
        <Route path="/impact" element={<ImpactPage user={user} />} />
        <Route
          path="/capacity"
          element={
            <StaffOnly user={user}>
              <CapacityPage user={user} />
            </StaffOnly>
          }
        />
        <Route
          path="/masters"
          element={
            <AdminOnly user={user}>
              <MastersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/masters/clients/:id"
          element={
            <AdminOnly user={user}>
              <ClientDetailPage />
            </AdminOnly>
          }
        />
        <Route
          path="/audit"
          element={
            <AdminOnly user={user}>
              <AuditPage />
            </AdminOnly>
          }
        />
        <Route
          path="/compliance"
          element={
            <AdminOnly user={user}>
              <CompliancePage />
            </AdminOnly>
          }
        />
        <Route path="/profile" element={<ProfilePage user={user} />} />
        <Route path="/legal/:key" element={<LegalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
