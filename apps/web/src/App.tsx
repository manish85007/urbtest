import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { authApi, type SecurityStatus, type SessionUser } from './api';
import { LogoIcon } from './components/BrandMark';
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
import { PasswordMustChangeGate } from './components/PasswordMustChangeGate';
import { MfaEnrolGate } from './components/MfaEnrolGate';

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
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [legalOk, setLegalOk] = useState(false);
  const [checkingLegal, setCheckingLegal] = useState(false);

  const refreshSecurity = useCallback(async () => {
    const { security: s } = await authApi.me();
    setSecurity(s);
    return s;
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then(({ user: u, security: s }) => {
        setUser(u);
        setSecurity(s);
      })
      .catch(() => {
        setUser(null);
        setSecurity(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setLegalOk(false);
      return;
    }
    if (security?.mustChangePassword) {
      setLegalOk(false);
      return;
    }
    setCheckingLegal(true);
    authApi
      .legalStatus()
      .then((s) => setLegalOk(s.compliant))
      .catch(() => setLegalOk(true))
      .finally(() => setCheckingLegal(false));
  }, [user, security?.mustChangePassword]);

  function onLogin(u: SessionUser, s: SecurityStatus) {
    setUser(u);
    setSecurity(s);
  }

  if (loading) {
    return (
      <div className="page-root">
        <div className="center">
          <div className="urb-spin-wrap">
            <LogoIcon className="urb-spin" />
            <p>Loading Urb TecTrack…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-root">
        <Routes>
          <Route path="/legal/:key" element={<LegalPage standalone />} />
          <Route path="*" element={<LoginPage onLogin={onLogin} />} />
        </Routes>
      </div>
    );
  }

  if (security?.mustChangePassword) {
    return (
      <div className="page-root">
        <PasswordMustChangeGate
          onChanged={() => {
            void refreshSecurity().catch(() => undefined);
          }}
        />
      </div>
    );
  }

  if (checkingLegal) {
    return (
      <div className="page-root">
        <div className="center">
          <div className="urb-spin-wrap">
            <LogoIcon className="urb-spin" />
            <p>Checking policies…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!legalOk) {
    return (
      <div className="page-root">
        <LegalConsentGate onAccepted={() => setLegalOk(true)} />
      </div>
    );
  }

  if (security?.mfaEnrolForced) {
    return (
      <div className="page-root">
        <MfaEnrolGate
          graceDays={security.mfaGraceDays}
          onEnrolled={() => {
            void refreshSecurity().catch(() => undefined);
          }}
        />
      </div>
    );
  }

  return (
    <Shell
      user={user}
      onLogout={() => {
        setUser(null);
        setSecurity(null);
      }}
      mfaGraceDaysLeft={
        security?.mfaRequired && !security.mfaEnrolled ? security.mfaGraceDaysLeft : null
      }
    >
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
