// src/app/(dashboard)/admin/lojas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Loja } from '@/types';
import {
  Building2, MapPin, Plus, Store,
  ToggleLeft, ToggleRight, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLojasPage() {
  const { perfil } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLojas();
  }, []);

  const fetchLojas = async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setLojas(data as Loja[]);
    setLoading(false);
  };

  const handleCreateLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('lojas')
      .insert([{ nome, endereco, ativa: true }]);

    if (error) {
      toast.error(`Erro: ${error.message}`);
    } else {
      toast.success('Loja cadastrada com sucesso!');
      setNome('');
      setEndereco('');
      fetchLojas();
    }
    setIsSubmitting(false);
  };

  // CORRIGIDO: kill switch com verificação anti-falha silenciosa
  const handleToggleAtiva = async (loja: Loja) => {
    const acao = loja.ativa ? 'suspender' : 'reativar';
    if (!confirm(
      loja.ativa
        ? `Suspender "${loja.nome}"? Todos os usuários desta loja perderão acesso imediatamente.`
        : `Reativar "${loja.nome}"?`
    )) return;

    setTogglingId(loja.id);

    // O .select() obriga o Supabase a devolver a linha alterada. 
    // Se a RLS bloquear, ele devolve vazio.
    const { data, error } = await supabase
      .from('lojas')
      .update({ ativa: !loja.ativa })
      .eq('id', loja.id)
      .select();

    if (error) {
      toast.error(`Erro técnico: ${error.message}`);
    } else if (!data || data.length === 0) {
      // Aqui nós pegamos a "falha silenciosa" no pulo!
      toast.error(`Permissão negada no banco para ${acao} a loja.`);
    } else {
      toast.success(`Loja ${loja.ativa ? 'suspensa' : 'reativada'} com sucesso!`);
      fetchLojas();
    }
    
    setTogglingId(null);
  };

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
          Admin Master — Gestão de Lojas
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Criação */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Nova Loja
            </h2>
            <form onSubmit={handleCreateLoja} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome da Loja / Unidade
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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

        {/* Lista de Lojas */}
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
                <div className="p-6 text-slate-500 text-center">Carregando...</div>
              ) : lojas.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">Nenhuma loja cadastrada.</div>
              ) : (
                lojas.map((loja) => (
                  <div key={loja.id} className={`p-6 flex items-center justify-between transition-colors ${!loja.ativa ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{loja.nome}</h3>
                        {/* CORRIGIDO: badge de status correto */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          loja.ativa
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {loja.ativa ? 'Ativa' : 'Suspensa'}
                        </span>
                      </div>
                      {loja.endereco && (
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {loja.endereco}
                        </p>
                      )}
                    </div>

                    {/* CORRIGIDO: kill switch funcional */}
                    <button
                      onClick={() => handleToggleAtiva(loja)}
                      disabled={togglingId === loja.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                        loja.ativa
                          ? 'text-red-600 hover:bg-red-50 border border-red-200'
                          : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
                      }`}
                      title={loja.ativa ? 'Suspender loja' : 'Reativar loja'}
                    >
                      {loja.ativa ? (
                        <>
                          <ToggleRight className="w-5 h-5" />
                          Suspender
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5" />
                          Reativar
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Aviso de kill switch */}
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              <strong>Atenção:</strong> Suspender uma loja bloqueia imediatamente todos os usuários vinculados a ela. A operação é reversível clicando em "Reativar".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
