// src/components/layout/LojaSuspensaGuard.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

// NOVO: componente que bloqueia acesso se a loja estiver suspensa (kill switch)
export function LojaSuspensaGuard({ children }: { children: React.ReactNode }) {
  const { lojaSuspensa, perfil } = useAuth();

  if (lojaSuspensa) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Acesso Suspenso</h2>
          <p className="text-slate-500 mt-2 max-w-sm">
            A sua loja está temporariamente suspensa. Entre em contato com o administrador do sistema.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Usuário: {perfil?.nome} · Cargo: {perfil?.cargo}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
