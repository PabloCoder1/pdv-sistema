// src/app/(dashboard)/relatorios/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Trophy, TrendingUp, Package, AlertCircle, 
  Download, Users, BarChart3, Receipt, ArrowUpRight 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { toast } from 'sonner';

type Periodo = '7d' | '30d' | 'mes_atual';

export default function RelatoriosPage() {
  const { perfil } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual');

  const isAdmin = perfil?.cargo === 'Administrador';

  useEffect(() => {
    if (perfil) fetchData();
  }, [perfil, periodo]);

  const getDataInicio = (): string => {
    const agora = new Date();
    if (periodo === '7d') {
      agora.setDate(agora.getDate() - 7);
      return agora.toISOString();
    }
    if (periodo === '30d') {
      agora.setDate(agora.getDate() - 30);
      return agora.toISOString();
    }
    return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const dataInicio = getDataInicio();

      let query = supabase
        .from('vendas')
        .select(`
          *,
          perfis(nome),
          itens_venda(quantidade, preco_unitario, preco_custo)
        `)
        .gte('created_at', dataInicio)
        .order('created_at', { ascending: true });

      if (!isAdmin && perfil?.loja_id) {
        query = query.eq('loja_id', perfil.loja_id);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setVendas(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PROCESSAMENTO DE DADOS (MÉTRICAS E GRÁFICOS) ---
  const stats = useMemo(() => {
    const metricas = {
      bruto: 0,
      liquido: 0,
      vendasPorColaborador: {} as Record<string, number>,
      faturamentoDiario: {} as Record<string, number>,
    };

    vendas.forEach(venda => {
      const totalVenda = Number(venda.total);
      metricas.bruto += totalVenda;

      // Cálculo de Lucro Líquido
      venda.itens_venda?.forEach((item: any) => {
        const custo = Number(item.preco_custo || 0);
        const vendaUnit = Number(item.preco_unitario || 0);
        metricas.liquido += (vendaUnit - custo) * Number(item.quantidade);
      });

      // Ranking de Colaboradores
      const nomeColab = venda.perfis?.nome || 'Desconhecido';
      metricas.vendasPorColaborador[nomeColab] = (metricas.vendasPorColaborador[nomeColab] || 0) + totalVenda;

      // Evolução Diária
      const data = new Date(venda.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      metricas.faturamentoDiario[data] = (metricas.faturamentoDiario[data] || 0) + totalVenda;
    });

    const rankingColaboradores = Object.entries(metricas.vendasPorColaborador)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    const dadosEvolucao = Object.entries(metricas.faturamentoDiario).map(([data, total]) => ({ data, total }));

    return { 
      ...metricas, 
      rankingColaboradores, 
      dadosEvolucao,
      margemLucro: metricas.bruto > 0 ? ((metricas.liquido / metricas.bruto) * 100).toFixed(1) : '0'
    };
  }, [vendas]);

  // --- FUNÇÃO DE EXPORTAÇÃO CSV ---
  const exportarRelatorio = () => {
    try {
      const cabecalho = "Data;Colaborador;Metodo;Total\n";
      const linhas = vendas.map(v => 
        `${new Date(v.created_at).toLocaleDateString()};${v.perfis?.nome};${v.metodo_pagamento};${v.total}`
      ).join("\n");
      
      const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `relatorio_vendas_${periodo}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Relatório exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao gerar arquivo.");
    }
  };

  const formatarMoeda = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400">Processando inteligência de dados...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Relatórios de Performance</h1>
          <p className="text-slate-500 font-medium">Análise detalhada de faturamento e produtividade</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['7d', '30d', 'mes_atual'] as Periodo[]).map((p) => (
              <button key={p} onClick={() => setPeriodo(p)} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${periodo === p ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {p === '7d' ? '7 DIAS' : p === '30d' ? '30 DIAS' : 'ESTE MÊS'}
              </button>
            ))}
          </div>
          <button onClick={exportarRelatorio} className="flex items-center gap-2 bg-slate-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg">
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Faturamento Total</p>
          <p className="text-3xl font-black text-slate-800">{formatarMoeda(stats.bruto)}</p>
          <div className="flex items-center gap-1 mt-2 text-emerald-600 font-bold text-xs">
            <Receipt className="w-4 h-4" /> {vendas.length} vendas concluídas
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Lucro Líquido Estimado</p>
          <p className="text-3xl font-black text-emerald-600">{formatarMoeda(stats.liquido)}</p>
          <p className="text-xs text-slate-400 mt-2 font-bold italic">Margem média: {stats.margemLucro}%</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Ticket Médio</p>
          <p className="text-3xl font-black text-slate-800">{formatarMoeda(vendas.length > 0 ? stats.bruto / vendas.length : 0)}</p>
          <p className="text-xs text-slate-400 mt-2">Média por cupom emitido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO DE EVOLUÇÃO */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" /> Curva de Faturamento
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={4} dot={{ r: 4, fill: '#059669' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RANKING DE COLABORADORES */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Ranking de Vendas (Por Colaborador)
          </h3>
          <div className="space-y-4">
            {stats.rankingColaboradores.map((colab, index) => (
              <div key={colab.nome} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                    {index + 1}º
                  </div>
                  <span className="font-bold text-slate-700">{colab.nome}</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-800">{formatarMoeda(colab.total)}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">
                    {((colab.total / stats.bruto) * 100).toFixed(0)}% do total
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}