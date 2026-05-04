// src/app/(dashboard)/colaboradores/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Perfil, Loja } from '@/types';
import {
  Users, Shield, Store as StoreIcon, Plus,
  Mail, Lock, Trash2, Camera, User, Edit, X
} from 'lucide-react';
import { uploadImage } from '@/lib/storage';
import { toast } from 'sonner';

export default function ColaboradoresPage() {
  const { perfil } = useAuth();
  const [colaboradores, setColaboradores] = useState<Perfil[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargo, setCargo] = useState<'Gerente' | 'Colaborador'>('Colaborador');
  const [lojaSelecionada, setLojaSelecionada] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = perfil?.cargo === 'Administrador';

  useEffect(() => {
    if (perfil) fetchData();
  }, [perfil]);

  const fetchData = async () => {
    setLoading(true);
    if (isAdmin) {
      const { data: lojasData } = await supabase.from('lojas').select('*');
      if (lojasData) setLojas(lojasData);
    }

    let query = supabase.from('perfis').select('*, lojas(nome)');
    if (!isAdmin && perfil?.loja_id) {
      query = query.eq('loja_id', perfil.loja_id);
    }

    const { data: perfisData } = await query;
    if (perfisData) setColaboradores(perfisData as any);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setEmail('');
    setPassword('');
    setCargo('Colaborador');
    setLojaSelecionada('');
    setAvatarFile(null);
  };

  // CORRIGIDO: passa o token JWT no header de todas as chamadas à API
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    };
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const targetLojaId = isAdmin ? lojaSelecionada : perfil?.loja_id;

      if (!targetLojaId && cargo !== 'Administrador') {
        throw new Error('Selecione uma loja para o colaborador.');
      }

      let avatarUrl = '';
      if (avatarFile) {
        avatarUrl = await uploadImage(avatarFile, 'avatars');
      }

      const payload = {
        id: editingId,
        nome,
        email,
        cargo,
        loja_id: targetLojaId,
        ...(password ? { password } : {}),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      };

      const method = editingId ? 'PUT' : 'POST';
      const headers = await getAuthHeaders();

      const response = await fetch('/api/usuarios', {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro na operação.');

      resetForm();
      fetchData();
      toast.success(editingId ? 'Membro atualizado!' : 'Membro criado com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user: Perfil) => {
    setEditingId(user.id);
    setNome(user.nome);
    setCargo(user.cargo === 'Administrador' ? 'Colaborador' : user.cargo as 'Gerente' | 'Colaborador');
    setLojaSelecionada(user.loja_id || '');
    setEmail('');
    setPassword('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Tem certeza? Isso removerá permanentemente o acesso deste usuário.')) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/usuarios?id=${id}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao remover acesso.');

      fetchData();
      toast.success('Acesso revogado com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (perfil?.cargo === 'Colaborador') {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
        Acesso negado. Apenas gestores podem gerenciar a equipe.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-600" />
          Gestão de Equipe
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className={`bg-white p-6 rounded-xl border shadow-sm transition-all ${editingId ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                {editingId ? 'Editar Membro' : 'Novo Acesso'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                  {avatarFile ? (
                    <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" alt="Avatar preview" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-300" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-slate-500">{editingId ? 'Trocar foto' : 'Foto de perfil'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail {editingId && <span className="text-[10px] text-amber-600">(Preencha para alterar)</span>}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required={!editingId}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
                    placeholder={editingId ? 'manter atual...' : ''}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha {editingId ? <span className="text-[10px] text-amber-600">(Preencha para redefinir)</span> : 'Inicial'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required={!editingId}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value as 'Gerente' | 'Colaborador')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Colaborador">Colaborador</option>
                  {/* CORRIGIDO: apenas Admin pode criar Gerentes */}
                  {isAdmin && <option value="Gerente">Gerente</option>}
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loja Alocada</label>
                  <select
                    required
                    value={lojaSelecionada}
                    onChange={(e) => setLojaSelecionada(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Selecione...</option>
                    {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 rounded-lg font-bold text-white transition-all disabled:opacity-50 ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isSubmitting ? 'Processando...' : editingId ? 'Salvar Alterações' : 'Criar Acesso'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-400" />
                Equipe Ativa
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Carregando...</div>
              ) : colaboradores.map((user) => {
                const podeGerenciarEsteUser = isAdmin || (perfil?.cargo === 'Gerente' && user.cargo === 'Colaborador');
                const isMesmoUsuario = user.id === perfil?.id;

                return (
                  <div key={user.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.nome} />
                        ) : (
                          <User className="w-6 h-6 m-3 text-slate-300" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{user.nome}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            user.cargo === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                            user.cargo === 'Gerente' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {user.cargo}
                          </span>
                          {(user as any).lojas?.nome && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <StoreIcon className="w-3 h-3" />
                              {(user as any).lojas.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {podeGerenciarEsteUser && !isMesmoUsuario && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                          title="Editar colaborador"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      {podeGerenciarEsteUser && !isMesmoUsuario && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Revogar acesso"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
