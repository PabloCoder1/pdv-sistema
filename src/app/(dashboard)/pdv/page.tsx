// src/app/(dashboard)/pdv/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Produto } from '@/types';
import { Search, ShoppingCart, Trash2, CreditCard, Plus, Minus, Receipt } from 'lucide-react';

// Tipagem local para o carrinho
interface ItemCarrinho extends Produto {
  quantidade_venda: number;
  subtotal: number;
}

export default function PdvPage() {
  const { perfil } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estado do Carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');

  useEffect(() => {
    if (perfil?.loja_id) {
      fetchProdutos(perfil.loja_id);
    } else {
      setLoading(false);
    }
  }, [perfil]);

  const fetchProdutos = async (lojaId: string) => {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .gt('estoque_atual', 0) // Traz apenas o que tem no estoque
      .order('nome');

    if (data) setProdutos(data as Produto[]);
    setLoading(false);
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho((prev) => {
      const itemExistente = prev.find((item) => item.id === produto.id);
      
      if (itemExistente) {
        // Verifica se tem estoque suficiente para adicionar mais um
        if (itemExistente.quantidade_venda >= produto.estoque_atual) {
          alert('Estoque insuficiente para este produto.');
          return prev;
        }
        
        return prev.map((item) =>
          item.id === produto.id
            ? {
                ...item,
                quantidade_venda: item.quantidade_venda + 1,
                subtotal: (item.quantidade_venda + 1) * item.preco,
              }
            : item
        );
      }

      return [...prev, { ...produto, quantidade_venda: 1, subtotal: produto.preco }];
    });
  };

  const alterarQuantidade = (id: string, delta: number) => {
    setCarrinho((prev) => 
      prev.map((item) => {
        if (item.id === id) {
          const novaQtd = item.quantidade_venda + delta;
          if (novaQtd === 0) return item; // Não deixa chegar a zero por aqui, usa o remover
          if (novaQtd > item.estoque_atual) return item; // Trava no limite do estoque
          
          return { ...item, quantidade_venda: novaQtd, subtotal: novaQtd * item.preco };
        }
        return item;
      })
    );
  };

  const removerDoCarrinho = (id: string) => {
    setCarrinho((prev) => prev.filter((item) => item.id !== id));
  };

  const totalVenda = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;
    setIsFinalizando(true);

    try {
      // 1. Cria o registro principal da Venda
      const { data: venda, error: erroVenda } = await supabase
        .from('vendas')
        .insert([{
          loja_id: perfil!.loja_id,
          usuario_id: perfil!.id,
          total: totalVenda,
          metodo_pagamento: metodoPagamento
        }])
        .select()
        .single();

      if (erroVenda) throw new Error('Erro ao criar venda principal.');

      // 2. Prepara os itens para inserção em lote (Batch Insert)
      const itensParaInserir = carrinho.map((item) => ({
        venda_id: venda.id,
        produto_id: item.id,
        quantidade: item.quantidade_venda,
        preco_unitario: item.preco,
        subtotal: item.subtotal
      }));

      const { error: erroItens } = await supabase.from('itens_venda').insert(itensParaInserir);
      if (erroItens) throw new Error('Erro ao registrar itens da venda.');

      // 3. Atualiza o estoque no frontend e banco (Para MVP. O ideal futuro é uma Trigger no PostgreSQL)
      for (const item of carrinho) {
        await supabase
          .from('produtos')
          .update({ estoque_atual: item.estoque_atual - item.quantidade_venda })
          .eq('id', item.id);
      }

      // Sucesso! Limpa o PDV para o próximo cliente
      setCarrinho([]);
      fetchProdutos(perfil!.loja_id!); // Recarrega o estoque atualizado
      alert('Venda finalizada com sucesso!');

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsFinalizando(false);
    }
  };

  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.includes(searchTerm))
  );

  const formatarMoeda = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  // Trava arquitetural: Admin global não opera caixa
  if (!perfil?.loja_id) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500 space-y-4">
        <Receipt className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-medium text-slate-700">Caixa Indisponível</h2>
        <p>Você precisa estar logado como Gerente ou Colaborador de uma Loja específica para operar o PDV.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6 overflow-hidden">
      
      {/* LADO ESQUERDO: Catálogo de Produtos */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar produto por nome ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-slate-500 mt-10">Carregando catálogo...</div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center text-slate-500 mt-10">Nenhum produto encontrado.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtosFiltrados.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => adicionarAoCarrinho(produto)}
                  className="flex flex-col text-left p-4 border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all bg-white group active:scale-95"
                >
                  <span className="font-semibold text-slate-800 line-clamp-2 mb-2 group-hover:text-emerald-700">
                    {produto.nome}
                  </span>
                  <span className="text-lg font-bold text-slate-900 mt-auto">
                    {formatarMoeda(produto.preco)}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Estoque: {produto.estoque_atual}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LADO DIREITO: Carrinho / Cupom Fiscal */}
      <div className="w-[400px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        <div className="p-4 bg-slate-900 text-white flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-emerald-400" />
          <h2 className="font-semibold text-lg">Cupom Atual</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {carrinho.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>O carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {carrinho.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-800 line-clamp-1">{item.nome}</span>
                    <button onClick={() => removerDoCarrinho(item.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                      <button onClick={() => alterarQuantidade(item.id, -1)} className="p-1 hover:bg-white rounded shadow-sm text-slate-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-medium text-sm w-4 text-center">{item.quantidade_venda}</span>
                      <button onClick={() => alterarQuantidade(item.id, 1)} className="p-1 hover:bg-white rounded shadow-sm text-slate-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-semibold text-slate-900">{formatarMoeda(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé de Pagamento */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['PIX', 'CARTAO', 'DINHEIRO'].map((metodo) => (
                <button
                  key={metodo}
                  onClick={() => setMetodoPagamento(metodo)}
                  className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                    metodoPagamento === metodo
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {metodo}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Total:</span>
            <span className="text-3xl font-bold text-slate-900">{formatarMoeda(totalVenda)}</span>
          </div>

          <button
            onClick={finalizarVenda}
            disabled={carrinho.length === 0 || isFinalizando}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <CreditCard className="w-5 h-5" />
            {isFinalizando ? 'Processando...' : 'Finalizar Venda (F9)'}
          </button>
        </div>
      </div>
    </div>
  );
}