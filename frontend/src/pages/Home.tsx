import { jeton } from '../services/storage';
import { nomEnseigne } from '../config/marque';
import { deconnexion } from '../services/session';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { t } from '../i18n';

function getTokenPayload(): { name: string; role: string } | null {
  const token = jeton();
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export default function Home() {
  const { settings } = useSettings();
  const nomMagasin = nomEnseigne(settings.nomMagasin);
  const initiales  = nomMagasin.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const navigate  = useNavigate();
  const payload   = getTokenPayload();

  const handleLogout = () => {
    void deconnexion().then(ok => { if (ok) window.location.href = '/login'; });
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-bordeaux text-cream shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center font-bold text-bordeaux text-lg">
              {initiales}
            </div>
            <h1 className="text-2xl font-bold tracking-wide">{nomMagasin} POS</h1>
          </div>
          <div className="flex items-center gap-3">
            {payload && (
              <span className="text-cream/70 text-sm hidden sm:block">
                {payload.name} <span className="text-gold">({payload.role})</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-cream/70 hover:text-cream text-sm border border-cream/20
                px-3 py-1 rounded-lg transition-colors hover:bg-cream/10"
            >
              {t('Déconnexion', 'Log out')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-bordeaux mb-3">{t('Bienvenue', 'Welcome')}</h2>
          <p className="text-gray-600 text-lg">{t('Gérez vos ventes, stocks et dépenses en toute simplicité.', 'Manage your sales, stock and expenses with ease.')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardCard
            title={t('Caisse', 'Checkout')}
            description={t('Enregistrer une nouvelle vente', 'Record a new sale')}
            icon="🛒"
            color="bg-bordeaux"
            onClick={() => navigate('/caisse')}
          />
          <DashboardCard
            title={t('Stocks', 'Stock')}
            description={t('Gérer le catalogue et les stocks', 'Manage the catalogue and stock')}
            icon="📦"
            color="bg-gold"
            onClick={() => navigate('/stocks')}
          />
          <DashboardCard
            title={t('Dépenses', 'Expenses')}
            description={t('Suivre les dépenses du magasin', 'Track store expenses')}
            icon="💰"
            color="bg-bordeaux"
            onClick={() => navigate('/depenses')}
          />
          <DashboardCard
            title="Dashboard"
            description={t("Vue d'ensemble — patron", 'Overview — owner')}
            icon="📊"
            color="bg-bordeaux-dark"
            onClick={() => navigate('/dashboard')}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label={t("Ventes aujourd'hui", 'Sales today')} value="0 FCFA" />
          <StatCard label={t('Produits en stock', 'Products in stock')} value="0" />
          <StatCard label={t('Alertes stock', 'Stock alerts')} value="0" alert />
        </div>
      </main>

      <footer className="bg-bordeaux text-cream text-center py-3 text-sm opacity-80">
        {nomMagasin} POS &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function DashboardCard({
  title, description, icon, color, onClick,
}: {
  title: string; description: string; icon: string; color: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`${color} text-cream rounded-2xl p-6 shadow-md cursor-pointer hover:opacity-90 transition-opacity`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold mb-1">{title}</h3>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow border border-cream-dark flex flex-col gap-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-bordeaux'}`}>
        {value}
      </span>
    </div>
  );
}
