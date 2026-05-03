// src/app/(dashboard)/page.tsx
'use client';

import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { perfil, loading } = useAuth();

  if (loading) return <div className="text-slate-500">Carregando painel...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Visão Geral</h1>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-slate-600">
          Bem-vindo, <strong className="text-slate-900">{perfil?.nome}</strong>. 
          Você está logado como <span className="text-emerald-600 font-semibold">{perfil?.cargo}</span>.
        </p>
      </div>
    </div>
  );
}