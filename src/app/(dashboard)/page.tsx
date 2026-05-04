// src/app/(dashboard)/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, ShoppingBag, TrendingUp, AlertCircle, RefreshCw, DollarSign, Clock, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardHome() {
  const { perfil, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Novos Estados para o Dashboard Avançado
  const [resumo, setResumo] = useState({ vendasHoje: 0, faturamentoHoje: 0, ticketMedio: 0 });
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([]);
  const [ultimasVendas, setUltimasVendas] = useState<any[]>([]);

  const isAdmin = perfil?.cargo === 'Administrador';

  useEffect(() => {
    if (perfil) {
      fetchDashboardData();
    } else {
      const timer = setTimeout(() => {
        if (!perfil) {
          setLoading(false);
          setError("Sessão não identificada. O sistema foi bloqueado por segurança.");
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [perfil]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Configura as datas (Últimos 7 dias e Hoje)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
      seteDiasAtras.setHours(0, 0, 0, 0);

      // 2. Busca Vendas dos últimos 7 dias
      let query = supabase
        .from('vendas')
        .select('id, total, created_at, metodo_pagamento, lojas(nome)')
        .gte('created_at', seteDiasAtras.toISOString())
        .order('created_at', { ascending: false });

      if (!isAdmin && perfil?.loja_id) {
        query = query.eq('loja_id', perfil.loja_id);
      }

      const { data: vendas, error: err } = await query;
      if (err) throw err;

      // 3. Processa os dados (Mindset Lean: fazemos tudo na memória com os dados já cacheados)
      const vendasHoje = vendas?.filter(v => new Date(v.created_at) >= hoje) || [];
      const faturamentoHoje = vendasHoje.reduce((acc, v) => acc + Number(v.total), 0);
      const ticketMedio = vendasHoje.length > 0 ? faturamentoHoje / vendasHoje.length : 0;

      setResumo({
        vendasHoje: vendasHoje.length,
        faturamentoHoje,
        ticketMedio
      });

      // 4. Prepara dados para o Gráfico (Agrupando por dia da semana)
      const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const mapaGrafico = new Map();

      // Inicializa os últimos 7 dias zerados para o gráfico ficar contínuo
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dataStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        mapaGrafico.set(dataStr, { nome: diasDaSemana[d.getDay()], data: dataStr, total: 0 });
      }

      // Preenche com os valores reais
      vendas?.forEach(v => {
        const d = new Date(v.created_at);
        const dataStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        if (mapaGrafico.has(dataStr)) {
          mapaGrafico.get(dataStr).total += Number(v.total);
        }
      });

      setDadosGrafico(Array.from(mapaGrafico.values()));

      // 5. Separa as 5 últimas vendas para a tabela
      setUltimasVendas(vendas?.slice(0, 5) || []);

    } catch (err: any) {
      console.error(err);
      setError("Não foi possível carregar os dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // --- RENDERIZAÇÃO DE ERRO E LOADING (MANTIDA IGUAL) ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Analisando dados operacionais...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-800">Atenção</h2>
        <p className="text-red-600 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold">
          Recarregar Painel
        </button>
      </div>
    );
  }

  // --- CÓDIGO VISUAL DO NOVO DASHBOARD ---
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-emerald-600" />
          Visão Geral
        </h1>
        <p className="text-slate-500 font-medium">Desempenho operacional em tempo real</p>
      </header>

      {/* CARDS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 transition-all hover:shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Faturamento (Hoje)</p>
            <p className="text-3xl font-black text-slate-800">{formatarMoeda(resumo.faturamentoHoje)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 transition-all hover:shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Vendas Concluídas</p>
            <p className="text-3xl font-black text-slate-800">{resumo.vendasHoje}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 transition-all hover:shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Ticket Médio</p>
            <p className="text-3xl font-black text-slate-800">{formatarMoeda(resumo.ticketMedio)}</p>
          </div>
        </div>
      </div>

      {/* ÁREA INFERIOR: GRÁFICO E LISTA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* GRÁFICO (Ocupa 2/3 da tela) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Faturamento (Últimos 7 dias)</h2>
              <p className="text-sm text-slate-500">Curva de evolução de receita</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  // AJUSTE AQUI: Tipamos o value como 'any' ou 'number | string' para o TS aceitar
                  formatter={(value: any) => [formatarMoeda(Number(value)), 'Faturamento']}
                  labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Bar dataKey="total" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ÚLTIMAS VENDAS (Ocupa 1/3 da tela) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Últimas Vendas
            </h2>
          </div>

          <div className="space-y-4">
            {ultimasVendas.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhuma venda registrada recentemente.</p>
            ) : (
              ultimasVendas.map((venda) => (
                <div key={venda.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{formatarMoeda(Number(venda.total))}</p>
                      <p className="text-xs text-slate-500 font-medium capitalize">
                        {venda.metodo_pagamento.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400">
                      {new Date(venda.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isAdmin && venda.lojas?.nome && (
                      <p className="text-[10px] text-slate-400 max-w-[80px] truncate">{venda.lojas.nome}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}