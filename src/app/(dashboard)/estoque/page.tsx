// src/app/(dashboard)/estoque/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Produto, Loja } from '@/types';
import { Package, Plus, Search, Barcode, DollarSign, Store as StoreIcon } from 'lucide-react';

export default function EstoquePage() {
  const { perfil } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados do formulário
  const [nome, setNome] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [preco, setPreco] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [lojaSelecionada, setLojaSelecionada] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = perfil?.cargo === 'Administrador';
  const podeCriarProduto = isAdmin || perfil?.cargo === 'Gerente';

  useEffect(() => {
    if (perfil) {
      fetchData();
    }
  }, [perfil]);

  const fetchData = async () => {
    setLoading(true);

    // Busca lojas para o select do Admin
    if (isAdmin) {
      const { data: lojasData } = await supabase.from('lojas').select('*');
      if (lojasData) setLojas(lojasData);
    }

    // Busca produtos isolados por loja
    let query = supabase.from('produtos').select('*, lojas(nome)').order('nome');
    
    if (!isAdmin && perfil?.loja_id) {
      query = query.eq('loja_id', perfil.loja_id);
    }

    const { data: produtosData } = await query;
    if (produtosData) {
      setProdutos(produtosData as any);
    }

    setLoading(false);
  };

  const handleCreateProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const targetLojaId = isAdmin ? lojaSelecionada : perfil?.loja_id;

    if (!targetLojaId) {
      alert('É necessário vincular o produto a uma loja.');
      setIsSubmitting(false);
      return;
    }

    // Conversão de valores textuais para números de banco de dados
    const precoNumerico = parseFloat(preco.replace(',', '.'));
    const estoqueNumerico = parseInt(estoqueAtual, 10);

    const { error } = await supabase
      .from('produtos')
      .insert([{
        nome,
        codigo_barras: codigoBarras || null, // Permite null se não tiver código
        preco: precoNumerico,
        estoque_atual: estoqueNumerico,
        loja_id: targetLojaId,
        ativo: true
      }]);

    if (!error) {
      setNome('');
      setCodigoBarras('');
      setPreco('');
      setEstoqueAtual('');
      if (isAdmin) setLojaSelecionada('');
      fetchData();
    } else {
      alert('Erro ao cadastrar produto: ' + error.message);
    }
    
    setIsSubmitting(false);
  };

  // Filtro de busca simples no lado do cliente (Lean)
  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.includes(searchTerm))
  );

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Package className="w-8 h-8 text-emerald-600" />
          Controle de Estoque
        </h1>
        
        {/* Barra de Busca Rápida */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Criação (Oculto para Colaboradores Base) */}
        {podeCriarProduto && (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                Novo Produto
              </h2>
              <form onSubmit={handleCreateProduto} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ex: Coca-Cola 2L"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras</label>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={preco}
                        onChange={(e) => setPreco(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qtd Inicial</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={estoqueAtual}
                      onChange={(e) => setEstoqueAtual(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vincular à Loja</label>
                    <select
                      required
                      value={lojaSelecionada}
                      onChange={(e) => setLojaSelecionada(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                  {isSubmitting ? 'Salvando...' : 'Cadastrar Produto'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Lista de Produtos (Tabela) */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${podeCriarProduto ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700">
                  <th className="p-4">Produto</th>
                  <th className="p-4">Preço</th>
                  <th className="p-4">Estoque</th>
                  {isAdmin && <th className="p-4">Loja</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500">Carregando catálogo...</td></tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum produto encontrado.</td></tr>
                ) : (
                  produtosFiltrados.map((produto) => (
                    <tr key={produto.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{produto.nome}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{produto.codigo_barras || 'Sem código'}</p>
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        {formatarMoeda(produto.preco)}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          produto.estoque_atual <= 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {produto.estoque_atual} un
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-sm text-slate-500 flex items-center gap-1.5">
                          <StoreIcon className="w-4 h-4" />
                          {(produto as any).lojas?.nome}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}