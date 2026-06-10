import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Setup } from "./pages/Setup";
import { Signup } from "./pages/Signup";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Profile } from "./pages/Profile";
import { Tresen } from "./pages/Tresen";
import { MemberShell } from "./pages/MemberShell";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Strichliste } from "./pages/admin/Strichliste";
import { GetraenkeLog } from "./pages/admin/GetraenkeLog";
import { Stats } from "./pages/admin/Stats";
import { Mitglieder } from "./pages/admin/Mitglieder";
import { Kategorien } from "./pages/admin/Kategorien";
import { Audit } from "./pages/admin/Audit";
import { Einstellungen } from "./pages/admin/Einstellungen";

export default function App() {
  const { member, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">Lade …</div>
    );
  }

  const requireAuth = (el: React.ReactNode) =>
    member ? el : <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const requireAdmin = (el: React.ReactNode) =>
    member?.role === "vorstand" ? el : <Navigate to={member ? "/" : "/login"} replace />;

  return (
    <Routes>
      <Route path="/login" element={member ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/signup" element={member ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/tresen" element={<Tresen />} />
      <Route element={requireAuth(<MemberShell />)}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/verlauf" element={<History />} />
        <Route path="/profil" element={<Profile />} />
      </Route>
      <Route path="/admin" element={requireAdmin(<AdminLayout />)}>
        <Route index element={<Strichliste />} />
        <Route path="log" element={<GetraenkeLog />} />
        <Route path="stats" element={<Stats />} />
        <Route path="mitglieder" element={<Mitglieder />} />
        <Route path="kategorien" element={<Kategorien />} />
        <Route path="audit" element={<Audit />} />
        <Route path="einstellungen" element={<Einstellungen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
