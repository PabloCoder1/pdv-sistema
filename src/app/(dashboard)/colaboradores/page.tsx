// src/app/(dashboard)/colaboradores/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Perfil, Loja } from '@/types';
import { Users, Shield, Store as StoreIcon, Plus, Mail, Lock } from 'lucide-react';

export default function ColaboradoresPage() {
  const { perfil } = useAuth();
  const [colaboradores, setColaboradores] = useState<Perfil[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargo, setCargo] = useState<'Gerente' | 'Colaborador'>('Colaborador');
  const [lojaSelecionada, setLojaSelecionada] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = perfil?.cargo === 'Administrador';

  useEffect(() => {
    if (perfil) {
      fetchData();
    }
  }, [perfil]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Busca Lojas (apenas se for Admin, para preencher o select)
    if (isAdmin) {
      const { data: lojasData } = await supabase.from('lojas').select('*');
      if (lojasData) setLojas(lojasData);
    }

    // 2. Busca Colaboradores baseados na permissão
    let query = supabase.from('perfis').select('*, lojas(nome)');
    
    // Se não for admin, filtra apenas os funcionários da própria loja
    if (!isAdmin && perfil?.loja_id) {
      query = query.eq('loja_id', perfil.loja_id);
    }

    const { data: perfisData } = await query;
    if (perfisData) {
      setColaboradores(perfisData as any);
    }

    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Define a loja: se for admin, usa a do select. Se for gerente, usa a própria.
    const targetLojaId = isAdmin ? lojaSelecionada : perfil?.loja_id;

    if (!targetLojaId && cargo !== 'Administrador' as any) {
      alert('Selecione uma loja para o colaborador.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nome,
          cargo,
          loja_id: targetLojaId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      // Limpa form e recarrega
      setNome('');
      setEmail('');
      setPassword('');
      setCargo('Colaborador');
      setLojaSelecionada('');
      fetchData();
      
      alert('Usuário criado com sucesso!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trava de segurança no frontend
  if (perfil?.cargo === 'Colaborador') {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
        Acesso negado. Apenas gestores podem acessar esta área.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-600" />
          Equipe
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Criação */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Novo Membro
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Acesso)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha Inicial</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="Colaborador">Colaborador (Caixa/Estoque)</option>
                  {isAdmin && <option value="Gerente">Gerente da Loja</option>}
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alocar na Loja</label>
                  <select
                    required
                    value={lojaSelecionada}
                    onChange={(e) => setLojaSelecionada(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Selecione uma loja...</option>
                    {lojas.map(loja => (
                      <option key={loja.id} value={loja.id}>{loja.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Registrando...' : 'Criar Acesso'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-500" />
                Usuários Ativos
              </h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-slate-500 text-center">Carregando equipe...</div>
              ) : colaboradores.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">Nenhum membro encontrado.</div>
              ) : (
                colaboradores.map((user) => (
                  <div key={user.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <h3 className="font-medium text-slate-900">{user.nome}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.cargo === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                          user.cargo === 'Gerente' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {user.cargo}
                        </span>
                        {/* Como extraímos a relação "lojas(nome)" no select, acessamos aqui */}
                        {(user as any).lojas?.nome && (
                          <span className="flex items-center gap-1">
                            <StoreIcon className="w-3 h-3" />
                            {(user as any).lojas.nome}
                          </span>
                        )}
                      </div>
                    </div>
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