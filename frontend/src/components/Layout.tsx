import React from 'react';
import Sidebar from './Sidebar';
import FilesBloqueesBanner from './FilesBloqueesBanner';
import BandeauLicence from './BandeauLicence';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--fs-ivory)' }}>
      <Sidebar />
      <div className="flex-1 overflow-auto min-w-0">
        {/* En tête de page, avant tout contenu : des ventes bloquées sur une
            autre boutique ne doivent pas se découvrir en fouillant un menu. */}
        <div style={{ padding: '12px 16px 0' }}>
          <BandeauLicence />
          <FilesBloqueesBanner />
        </div>
        {children}
      </div>
    </div>
  );
}
