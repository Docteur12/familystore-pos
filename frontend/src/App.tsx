import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Caisse from './pages/Caisse';
import Stocks from './pages/Stocks';
import Depenses from './pages/Depenses';
import Dashboard from './pages/Dashboard';
import Rapports from './pages/Rapports';
import Produits from './pages/Produits';
import Alertes from './pages/Alertes';
import Utilisateurs from './pages/Utilisateurs';
import GestionProduits from './pages/GestionProduits';
import CaissePin from './pages/CaissePin';
import StocksReceptions  from './pages/StocksReceptions';
import StocksInventaire  from './pages/StocksInventaire';
import StocksAlertes     from './pages/StocksAlertes';
import StocksEtiquettes  from './pages/StocksEtiquettes';
import StocksDepots      from './pages/StocksDepots';
import StocksFournisseurs from './pages/StocksFournisseurs';
import StocksDashboard   from './pages/StocksDashboard';
import AdminDashboard    from './pages/AdminDashboard';
import AdminCaissiers    from './pages/AdminCaissiers';
import AdminGestionnaires from './pages/AdminGestionnaires';
import AdminEquipe       from './pages/AdminEquipe';
import AdminRapports     from './pages/AdminRapports';
import AdminJournal      from './pages/AdminJournal';
import AdminParametres   from './pages/AdminParametres';
import AdminComptabilite from './pages/AdminComptabilite';
import AdminRoles        from './pages/AdminRoles';
import AdminAudit        from './pages/AdminAudit';
import AdminExports      from './pages/AdminExports';
import AdminFactures     from './pages/AdminFactures';
import AdminSessions     from './pages/AdminSessions';
import AdminMagaziniers  from './pages/AdminMagaziniers';
import AdminCaisses      from './pages/AdminCaisses';
import Magazinier        from './pages/Magazinier';
import { getTokenPayload } from './api/dashboard';

const INACTIVITY_MS = 10 * 60 * 1000;
const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

// Composant racine qui gère l'inactivité globale — ne se démonte jamais
function InactivityWatcher() {
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = getTokenPayload();
      // La Caisse gère son propre verrouillage — on ne touche pas à sa page
      if (!payload) return;
      if (window.location.pathname === '/caisse') return;
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }, INACTIVITY_MS);
  };

  useEffect(() => {
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Une seule fois au montage racine

  // Réinitialiser le timer à chaque changement de page
  useEffect(() => { resetTimer(); }, [location.pathname]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireAuthBare({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string | string[]; children: React.ReactNode }) {
  const token   = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  const payload = getTokenPayload();
  const roles   = Array.isArray(role) ? role : [role];
  if (!payload || !roles.includes(payload.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const payload = getTokenPayload();
  const role = payload?.role;
  if (role === 'patron')       return <Navigate to="/admin/dashboard" replace />;
  if (role === 'gestionnaire') return <Navigate to="/stocks/dashboard" replace />;
  if (role === 'magazinier')   return <Navigate to="/magazinier" replace />;
  return <Navigate to="/caisse-pin" replace />;
}

export default function App() {
  return (
    <SettingsProvider>
    <BrowserRouter>
      <InactivityWatcher />
      <Routes>
        <Route path="/login"     element={<Login />} />
        <Route path="/"          element={<RequireAuth><HomeRedirect /></RequireAuth>} />
        <Route path="/caisse-pin" element={<RequireAuthBare><CaissePin /></RequireAuthBare>} />
        <Route path="/caisse"    element={<RequireAuthBare><Caisse /></RequireAuthBare>} />
        <Route path="/stocks"    element={<RequireAuthBare><Stocks /></RequireAuthBare>} />
        <Route path="/depenses"  element={<RequireAuth><Depenses /></RequireAuth>} />
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/rapports"  element={<RequireAuth><Rapports /></RequireAuth>} />
        <Route path="/produits"  element={<RequireAuth><Produits /></RequireAuth>} />
        <Route path="/alertes"      element={<RequireAuth><Alertes /></RequireAuth>} />
        <Route path="/utilisateurs"    element={<RequireAuth><Utilisateurs /></RequireAuth>} />
        <Route path="/gestion-produits"      element={<RequireAuth><GestionProduits /></RequireAuth>} />
        <Route path="/stocks/receptions"    element={<RequireAuthBare><StocksReceptions /></RequireAuthBare>} />
        <Route path="/stocks/inventaire"    element={<RequireAuthBare><StocksInventaire /></RequireAuthBare>} />
        <Route path="/stocks/alertes"       element={<RequireAuthBare><StocksAlertes /></RequireAuthBare>} />
        <Route path="/stocks/etiquettes"    element={<RequireAuthBare><StocksEtiquettes /></RequireAuthBare>} />
        <Route path="/stocks/depots"        element={<RequireAuthBare><StocksDepots /></RequireAuthBare>} />
        <Route path="/stocks/fournisseurs"  element={<RequireAuthBare><StocksFournisseurs /></RequireAuthBare>} />
        <Route path="/stocks/dashboard"     element={<RequireAuthBare><StocksDashboard /></RequireAuthBare>} />
        <Route path="/admin/dashboard"    element={<RequireAuthBare><AdminDashboard /></RequireAuthBare>} />
        <Route path="/admin/caissiers"     element={<RequireAuthBare><AdminCaissiers /></RequireAuthBare>} />
        <Route path="/admin/gestionnaires" element={<RequireAuthBare><AdminGestionnaires /></RequireAuthBare>} />
        <Route path="/admin/equipe"        element={<RequireAuthBare><AdminEquipe /></RequireAuthBare>} />
        <Route path="/admin/rapports"      element={<RequireAuthBare><AdminRapports /></RequireAuthBare>} />
        <Route path="/admin/journal"       element={<RequireAuthBare><AdminJournal /></RequireAuthBare>} />
        <Route path="/admin/parametres"    element={<RequireAuthBare><AdminParametres /></RequireAuthBare>} />
        <Route path="/admin/comptabilite"  element={<RequireAuthBare><AdminComptabilite /></RequireAuthBare>} />
        <Route path="/admin/roles"         element={<RequireAuthBare><AdminRoles /></RequireAuthBare>} />
        <Route path="/admin/audit"         element={<RequireAuthBare><AdminAudit /></RequireAuthBare>} />
        <Route path="/admin/exports"       element={<RequireAuthBare><AdminExports /></RequireAuthBare>} />
        <Route path="/admin/factures"      element={<RequireAuthBare><AdminFactures /></RequireAuthBare>} />
        <Route path="/admin/sessions"      element={<RequireAuthBare><AdminSessions /></RequireAuthBare>} />
        <Route path="/admin/magaziniers"   element={<RequireAuthBare><AdminMagaziniers /></RequireAuthBare>} />
        <Route path="/admin/caisses"       element={<RequireAuthBare><AdminCaisses /></RequireAuthBare>} />
        <Route path="/magazinier"          element={<RequireRole role={['magazinier','patron']}><Magazinier /></RequireRole>} />
      </Routes>
    </BrowserRouter>
    </SettingsProvider>
  );
}
