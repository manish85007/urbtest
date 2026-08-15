import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authApi, type SessionUser } from './api';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Shell } from './components/Shell';

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="center">Loading Urb TecTrack…</div>;
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <Shell user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
