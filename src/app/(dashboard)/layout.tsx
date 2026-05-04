// src/app/(dashboard)/layout.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar'; 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, lojaSuspensa } = useAuth();

  // A TRAVA DE SEGURANÇA (O Porteiro)
  if (loading || lojaSuspensa) {
    return null; 
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />

      {/* ADICIONAMOS O p-8 AQUI PARA DAR O ESPAÇAMENTO (RESPIRO) */}
      <main className="flex-1 overflow-y-auto p-8 ml-64">
        {children}
      </main>
    </div>
  );
}