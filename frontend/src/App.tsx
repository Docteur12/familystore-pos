import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { getTokenPayload } from './api/dashboard';

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

function HomeRedirect() {
  const payload = getTokenPayload();
  const role = payload?.role;
  if (role === 'patron') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'gestionnaire') return <Navigate to="/stocks" replace />;
  return <Navigate to="/caisse-pin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  );
}
