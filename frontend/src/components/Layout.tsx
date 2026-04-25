import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--fs-ivory)' }}>
      <Sidebar />
      <div className="flex-1 overflow-auto min-w-0">
        {children}
      </div>
    </div>
  );
}
