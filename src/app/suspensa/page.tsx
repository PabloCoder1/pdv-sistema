// src/app/suspensa/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function SuspensaPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl text-center space-y-6">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto border-8 border-red-100">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Acesso Suspenso</h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            O sistema operacional desta unidade encontra-se temporariamente bloqueado. Entre em contato com a administração para regularizar a situação.
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
}