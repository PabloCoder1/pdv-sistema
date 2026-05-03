// src/app/(dashboard)/lojas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loja } from '@/types';
import { Building2, MapPin, Plus, Store } from 'lucide-react';

export default function LojasPage() {
  const { perfil } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados do formulário
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLojas();
  }, []);

  const fetchLojas = async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLojas(data);
    }
    setLoading(false);
  };

  const handleCreateLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('lojas')
      .insert([{ nome, endereco }]);

    if (!error) {
      setNome('');
      setEndereco('');
      fetchLojas(); // Recarrega a lista
    } else {
      alert('Erro ao criar loja. Verifique o console.');
      console.error(error);
    }
    
    setIsSubmitting(false);
  };

  // Trava de segurança: Apenas Admin acessa esta tela
  if (perfil?.cargo !== 'Administrador') {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
        Acesso negado. Apenas administradores podem gerenciar lojas.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Store className="w-8 h-8 text-emerald-600" />
          Gestão de Lojas
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Formulário de Criação */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Nova Filial
            </h2>
            <form onSubmit={handleCreateLoja} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome da Loja/Unidade
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Ex: Matriz Centro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Rua, Número, Bairro"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Cadastrando...' : 'Cadastrar Loja'}
              </button>
            </form>
          </div>
        </div>

        {/* Coluna 2: Lista de Lojas */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-500" />
                Lojas Cadastradas
              </h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-slate-500 text-center">Carregando lojas...</div>
              ) : lojas.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">Nenhuma loja cadastrada ainda.</div>
              ) : (
                lojas.map((loja) => (
                  <div key={loja.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <h3 className="font-medium text-slate-900">{loja.nome}</h3>
                    {loja.endereco && (
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {loja.endereco}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}