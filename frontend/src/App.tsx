import { lireSession, ecrireSession, supprimerTousLesJetons, jeton } from './services/storage';
import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import type { ModuleId } from './api/settings';
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
import AdminPosteCaisse  from './pages/AdminPosteCaisse';
import AdminComptabilite from './pages/AdminComptabilite';
import AdminRoles        from './pages/AdminRoles';
import AdminAudit        from './pages/AdminAudit';
import AdminExports      from './pages/AdminExports';
import AdminFactures     from './pages/AdminFactures';
import AdminSessions     from './pages/AdminSessions';
import AdminMagaziniers  from './pages/AdminMagaziniers';
import AdminPartenaires  from './pages/AdminPartenaires';
import RapportConsolide  from './pages/RapportConsolide';
import AdminFournisseurs from './pages/AdminFournisseurs';
import AdminCaisses      from './pages/AdminCaisses';
import Magazinier        from './pages/Magazinier';
import StocksEcarts      from './pages/StocksEcarts';
import StocksDivers      from './pages/StocksDivers';
import Partenaires       from './pages/Partenaires';
import PartenairesAgencesMaquette from './pages/PartenairesAgencesMaquette';
import { getTokenPayload } from './api/dashboard';

// ── Sécurité machine partagée : pas de reprise automatique de session ────────
// À chaque OUVERTURE de l'application (machine fermée puis rouverte), la
// session précédente n'est PAS restaurée : l'écran de connexion s'affiche pour
// que chaque utilisateur ouvre SON compte (indispensable avec plusieurs
// comptes caisses). sessionStorage est vidé quand l'app est fermée, mais
// conservé lors d'un simple rafraîchissement ou d'une navigation interne — on
// ne déconnecte donc jamais quelqu'un en plein travail.
(() => {
  try {
    if (!lireSession('fs_session_ouverte')) {
      // Démarrage à froid → reconnexion. On retire les jetons de TOUTES les
      // boutiques (aucun dormant) mais on ne touche PAS aux files hors-ligne :
      // elles attendent la reconnexion sur leur boutique.
      supprimerTousLesJetons();
    }
    ecrireSession('fs_session_ouverte', '1');
  } catch { /* stockage indisponible : ne pas bloquer l'app */ }
})();

const INACTIVITY_MS_DEFAULT = 10 * 60 * 1000;
const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

// Composant racine qui gère l'inactivité globale — ne se démonte jamais
function InactivityWatcher() {
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Durée d'inactivité paramétrable par magasin (Paramètres → règles métier).
  const { settings } = useSettings();
  const minutes = Number(settings.metier?.inactiviteMinutes);
  const inactivityMs = minutes > 0 ? minutes * 60 * 1000 : INACTIVITY_MS_DEFAULT;
  const msRef = useRef(inactivityMs);
  msRef.current = inactivityMs;

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = getTokenPayload();
      // La Caisse gère son propre verrouillage — on ne touche pas à sa page
      if (!payload) return;
      if (window.location.pathname === '/caisse') return;
      supprimerTousLesJetons();
      window.location.href = '/login';
    }, msRef.current);
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

  // Réinitialiser le timer à chaque changement de page ou de durée paramétrée
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { resetTimer(); }, [location.pathname, inactivityMs]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = jeton();
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireAuthBare({ children }: { children: React.ReactNode }) {
  const token = jeton();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Route d'un module optionnel : si le module est désactivé pour ce magasin
// (Paramètres → modules), on renvoie à l'accueil.
function RequireModule({ id, children }: { id: ModuleId; children: React.ReactNode }) {
  const { hasModule } = useSettings();
  if (!hasModule(id)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string | string[]; children: React.ReactNode }) {
  const token   = jeton();
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
  if (role === 'commercial')   return <Navigate to="/partenaires" replace />;
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
        <Route path="/stocks/ecarts"        element={<RequireAuthBare><StocksEcarts /></RequireAuthBare>} />
        <Route path="/stocks/divers"        element={<RequireAuthBare><StocksDivers /></RequireAuthBare>} />
        <Route path="/stocks/dashboard"     element={<RequireAuthBare><StocksDashboard /></RequireAuthBare>} />
        <Route path="/admin/dashboard"    element={<RequireAuthBare><AdminDashboard /></RequireAuthBare>} />
        <Route path="/admin/caissiers"     element={<RequireAuthBare><AdminCaissiers /></RequireAuthBare>} />
        <Route path="/admin/gestionnaires" element={<RequireAuthBare><AdminGestionnaires /></RequireAuthBare>} />
        <Route path="/admin/equipe"        element={<RequireAuthBare><AdminEquipe /></RequireAuthBare>} />
        <Route path="/admin/rapports"      element={<RequireAuthBare><AdminRapports /></RequireAuthBare>} />
        <Route path="/admin/journal"       element={<RequireAuthBare><AdminJournal /></RequireAuthBare>} />
        <Route path="/admin/parametres"    element={<RequireAuthBare><AdminParametres /></RequireAuthBare>} />
        <Route path="/admin/poste-caisse"  element={<RequireAuthBare><AdminPosteCaisse /></RequireAuthBare>} />
        <Route path="/admin/comptabilite"  element={<RequireAuthBare><AdminComptabilite /></RequireAuthBare>} />
        <Route path="/admin/roles"         element={<RequireAuthBare><AdminRoles /></RequireAuthBare>} />
        <Route path="/admin/audit"         element={<RequireAuthBare><AdminAudit /></RequireAuthBare>} />
        <Route path="/admin/exports"       element={<RequireAuthBare><AdminExports /></RequireAuthBare>} />
        <Route path="/admin/factures"      element={<RequireAuthBare><AdminFactures /></RequireAuthBare>} />
        <Route path="/admin/sessions"      element={<RequireAuthBare><AdminSessions /></RequireAuthBare>} />
        <Route path="/admin/magaziniers"   element={<RequireAuthBare><AdminMagaziniers /></RequireAuthBare>} />
        <Route path="/admin/consolide"     element={<RequireRole role={['patron']}><RapportConsolide /></RequireRole>} />
        <Route path="/admin/partenaires"   element={<RequireModule id="partenaires"><RequireAuthBare><AdminPartenaires /></RequireAuthBare></RequireModule>} />
        <Route path="/admin/fournisseurs"  element={<RequireAuthBare><AdminFournisseurs /></RequireAuthBare>} />
        <Route path="/admin/caisses"       element={<RequireAuthBare><AdminCaisses /></RequireAuthBare>} />
        <Route path="/magazinier"          element={<RequireRole role={['magazinier','patron']}><Magazinier /></RequireRole>} />
        <Route path="/partenaires"         element={<RequireModule id="partenaires"><RequireRole role={['patron','commercial']}><Partenaires /></RequireRole></RequireModule>} />
        <Route path="/maquette/agences"    element={<RequireModule id="partenaires"><PartenairesAgencesMaquette /></RequireModule>} />
      </Routes>
    </BrowserRouter>
    </SettingsProvider>
  );
}
