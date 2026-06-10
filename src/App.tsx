import { Suspense, lazy } from "react";
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

// Bundle-Splitting: Admin-Bereich (inkl. Recharts, ~0,5 MB) und Wrapped werden
// erst geladen, wenn sie aufgerufen werden — Mitglieder-Handys laden nur die App-Shell.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const Strichliste = lazy(() => import("./pages/admin/Strichliste").then((m) => ({ default: m.Strichliste })));
const GetraenkeLog = lazy(() => import("./pages/admin/GetraenkeLog").then((m) => ({ default: m.GetraenkeLog })));
const Abrechnung = lazy(() => import("./pages/admin/Abrechnung").then((m) => ({ default: m.Abrechnung })));
const Stats = lazy(() => import("./pages/admin/Stats").then((m) => ({ default: m.Stats })));
const Mitglieder = lazy(() => import("./pages/admin/Mitglieder").then((m) => ({ default: m.Mitglieder })));
const Kategorien = lazy(() => import("./pages/admin/Kategorien").then((m) => ({ default: m.Kategorien })));
const Audit = lazy(() => import("./pages/admin/Audit").then((m) => ({ default: m.Audit })));
const Einstellungen = lazy(() => import("./pages/admin/Einstellungen").then((m) => ({ default: m.Einstellungen })));
const Wrapped = lazy(() => import("./pages/Wrapped").then((m) => ({ default: m.Wrapped })));

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
    <Suspense
      fallback={<div className="flex min-h-dvh items-center justify-center text-muted">Lade …</div>}
    >
      <Routes>
        <Route path="/login" element={member ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/signup" element={member ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/tresen" element={<Tresen />} />
        <Route path="/wrapped" element={requireAuth(<Wrapped />)} />
        <Route element={requireAuth(<MemberShell />)}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/verlauf" element={<History />} />
          <Route path="/profil" element={<Profile />} />
        </Route>
        <Route path="/admin" element={requireAdmin(<AdminLayout />)}>
          <Route index element={<Strichliste />} />
          <Route path="log" element={<GetraenkeLog />} />
          <Route path="abrechnung" element={<Abrechnung />} />
          <Route path="stats" element={<Stats />} />
          <Route path="mitglieder" element={<Mitglieder />} />
          <Route path="kategorien" element={<Kategorien />} />
          <Route path="audit" element={<Audit />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
