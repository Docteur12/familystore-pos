import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-bordeaux text-cream shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center font-bold text-bordeaux text-lg">
              FS
            </div>
            <h1 className="text-2xl font-bold tracking-wide">Family Store POS</h1>
          </div>
          <span className="text-gold text-sm font-medium">Point de Vente</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-bordeaux mb-3">Bienvenue</h2>
          <p className="text-gray-600 text-lg">Gérez vos ventes, stocks et dépenses en toute simplicité.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardCard
            title="Caisse"
            description="Enregistrer une nouvelle vente"
            icon="🛒"
            color="bg-bordeaux"
            onClick={() => navigate('/caisse')}
          />
          <DashboardCard
            title="Stocks"
            description="Gérer le catalogue et les stocks"
            icon="📦"
            color="bg-gold"
            onClick={() => navigate('/stocks')}
          />
          <DashboardCard
            title="Dépenses"
            description="Suivre les dépenses du magasin"
            icon="💰"
            color="bg-bordeaux"
            onClick={() => navigate('/depenses')}
          />
          <DashboardCard
            title="Dashboard"
            description="Vue d'ensemble — patron"
            icon="📊"
            color="bg-bordeaux-dark"
            onClick={() => navigate('/dashboard')}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Ventes aujourd'hui" value="0 FCFA" />
          <StatCard label="Produits en stock" value="0" />
          <StatCard label="Alertes stock" value="0" alert />
        </div>
      </main>

      <footer className="bg-bordeaux text-cream text-center py-3 text-sm opacity-80">
        Family Store POS &copy; {new Date().getFullYear()}
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
