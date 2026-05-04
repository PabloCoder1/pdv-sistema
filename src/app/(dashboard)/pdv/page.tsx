// src/app/(dashboard)/pdv/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Produto } from '@/types';
import { Search, ShoppingCart, Trash2, CreditCard, Plus, Minus, Receipt, Barcode } from 'lucide-react';
import { toast } from 'sonner';
import { formatarMoeda } from '@/lib/formatters';

interface ItemCarrinho extends Produto {
  quantidade_venda: number;
  subtotal: number;
}

export default function PdvPage() {
  const { perfil } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const [valorRecebido, setValorRecebido] = useState(''); // NOVO: para cálculo de troco
  const [confirmarVenda, setConfirmarVenda] = useState(false); // Estado para o modal de confirmação
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (perfil?.loja_id) {
      fetchProdutos(perfil.loja_id);
    } else {
      setLoading(false);
    }
  }, [perfil]);

  // Mantém o foco no campo de busca para leitura de código de barras
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Qualquer tecla fora de um input focado volta o foco para a busca
      if (
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT' &&
        document.activeElement?.tagName !== 'BUTTON'
      ) {
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchProdutos = async (lojaId: string) => {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .gt('estoque_atual', 0)
      .order('nome');

    if (data) setProdutos(data as Produto[]);
    setLoading(false);
  };

  const adicionarAoCarrinho = useCallback((produto: Produto) => {
    setCarrinho((prev) => {
      const itemExistente = prev.find((item) => item.id === produto.id);

      if (itemExistente) {
        if (itemExistente.quantidade_venda >= produto.estoque_atual) {
          toast.warning('Quantidade máxima atingida para este produto.');
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
  }, []);

  // NOVO: suporte a leitura de código de barras — Enter no campo de busca
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const resultados = produtosFiltrados;
      if (resultados.length === 1) {
        adicionarAoCarrinho(resultados[0]);
        setSearchTerm('');
      } else if (resultados.length === 0) {
        toast.error('Produto não encontrado.');
      }
    }
  };

  const alterarQuantidade = (id: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const novaQtd = item.quantidade_venda + delta;
            if (novaQtd <= 0) return null as any; // remove do carrinho
            if (novaQtd > item.estoque_atual) {
              toast.warning('Estoque insuficiente.');
              return item;
            }
            return { ...item, quantidade_venda: novaQtd, subtotal: novaQtd * item.preco };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removerDoCarrinho = (id: string) => {
    setCarrinho((prev) => prev.filter((item) => item.id !== id));
  };

  const totalVenda = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  // NOVO: cálculo de troco
  const valorRecebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const troco = metodoPagamento === 'DINHEIRO' ? Math.max(0, valorRecebidoNum - totalVenda) : 0;
  const trocoNegativo = metodoPagamento === 'DINHEIRO' && valorRecebidoNum > 0 && valorRecebidoNum < totalVenda;

  // Atalho F9 para finalizar venda
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F9 para finalizar venda (apenas se não estiver em um input de texto ou similar)
      if (e.key === 'F9' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'SELECT') {
        e.preventDefault();
        if (carrinho.length > 0 && !isFinalizando && !trocoNegativo) {
          setConfirmarVenda(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [carrinho.length, isFinalizando, trocoNegativo]);

  

  // CORRIGIDO: chama a RPC atômica no Supabase — uma única transação no banco
  // Isso garante que estoque só baixa se a venda for registrada com sucesso
  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;
    if (metodoPagamento === 'DINHEIRO' && valorRecebidoNum < totalVenda) {
      toast.error('Valor recebido menor que o total da venda.');
      return;
    }

    setIsFinalizando(true);

    try {
      const itens = carrinho.map((item) => ({
        produto_id: item.id,
        quantidade: item.quantidade_venda,
        preco_unitario: item.preco,
        preco_custo: item.preco_custo, // snapshot do custo atual
        subtotal: item.subtotal,
      }));

      // CORRIGIDO: uma única RPC transacional substitui as 3 operações separadas
      const { error } = await supabase.rpc('processar_venda', {
        p_loja_id: perfil!.loja_id,
        p_usuario_id: perfil!.id,
        p_total: totalVenda,
        p_metodo_pagamento: metodoPagamento,
        p_valor_recebido: metodoPagamento === 'DINHEIRO' ? valorRecebidoNum : totalVenda,
        p_itens: itens,
      });

      if (error) {
        // Erros do banco chegam aqui — ex: "Estoque insuficiente para X"
        throw new Error(error.message);
      }

      // Limpa o estado e recarrega produtos com estoque atualizado
      setCarrinho([]);
      setValorRecebido('');
      fetchProdutos(perfil!.loja_id!);
      toast.success('Venda finalizada com sucesso!');

    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar venda.');
    } finally {
      setIsFinalizando(false);
    }
  };

  const produtosFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(searchTerm))
  );

  if (!perfil?.loja_id) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500 space-y-4">
        <Receipt className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-medium text-slate-700">Caixa Indisponível</h2>
        <p>Apenas colaboradores vinculados a uma loja podem operar o PDV.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6 overflow-hidden">
      {/* Catálogo de produtos */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por nome ou código de barras... (Enter = adicionar)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown} // NOVO: suporte a leitor de código de barras
              className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900"
              autoFocus
            />
            <Barcode className="absolute right-3 top-2.5 h-5 w-5 text-slate-300" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-slate-500 mt-10">Carregando produtos...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtosFiltrados.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => adicionarAoCarrinho(produto)}
                  className="flex flex-col text-left p-4 border border-slate-200 rounded-xl hover:border-emerald-500 transition-all bg-white group active:scale-95 shadow-sm"
                >
                  {produto.imagem_url && (
                    <img
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="w-full h-20 object-cover rounded-lg mb-2"
                    />
                  )}
                  <span className="font-semibold text-slate-800 line-clamp-2 mb-2">{produto.nome}</span>
                  <span className="text-lg font-bold text-slate-900 mt-auto">{formatarMoeda(produto.preco)}</span>
                  <span className={`text-xs mt-1 font-semibold ${
                    produto.estoque_atual <= 5 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {produto.estoque_atual <= 5 ? `⚠ Últimas ${produto.estoque_atual} un` : `${produto.estoque_atual} un`}
                  </span>
                </button>
              ))}
              {produtosFiltrados.length === 0 && !loading && (
                <div className="col-span-4 text-center text-slate-400 mt-10">
                  Nenhum produto encontrado.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Carrinho */}
      <div className="w-[400px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        <div className="p-4 bg-slate-900 text-white flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-emerald-400" />
          <h2 className="font-semibold text-lg">Cupom Fiscal</h2>
          {carrinho.length > 0 && (
            <button
              onClick={() => setCarrinho([])}
              className="ml-auto text-slate-500 hover:text-red-400 text-xs"
              title="Limpar carrinho"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {carrinho.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <ShoppingCart className="w-12 h-12 opacity-10" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {carrinho.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-800 text-sm line-clamp-1">{item.nome}</span>
                    <button onClick={() => removerDoCarrinho(item.id)} className="text-slate-400 hover:text-red-500 ml-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => alterarQuantidade(item.id, -1)}
                        className="p-1 hover:bg-white rounded text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs w-4 text-center">{item.quantidade_venda}</span>
                      <button
                        onClick={() => alterarQuantidade(item.id, 1)}
                        className="p-1 hover:bg-white rounded text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-bold text-slate-900">{formatarMoeda(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
          {/* Método de pagamento */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['PIX', 'CARTAO', 'DINHEIRO'].map((metodo) => (
                <button
                  key={metodo}
                  onClick={() => {
                    setMetodoPagamento(metodo);
                    setValorRecebido('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    metodoPagamento === metodo
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {metodo}
                </button>
              ))}
            </div>
          </div>

          {/* NOVO: campo de valor recebido (apenas para dinheiro) */}
          {metodoPagamento === 'DINHEIRO' && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Valor Recebido (R$)
              </label>
              <input
                type="text"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="0,00"
                className={`w-full px-3 py-2 border rounded-lg text-lg font-bold text-center text-slate-900 ${
                  trocoNegativo ? 'border-red-400 bg-red-50' : 'border-slate-300'
                }`}
              />
              {valorRecebidoNum > 0 && !trocoNegativo && (
                <p className="text-sm text-emerald-600 font-bold text-center mt-1">
                  Troco: {formatarMoeda(troco)}
                </p>
              )}
              {trocoNegativo && (
                <p className="text-sm text-red-500 font-bold text-center mt-1">
                  Valor insuficiente
                </p>
              )}
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-400 text-sm font-bold">TOTAL</span>
            <span className="text-3xl font-black text-slate-900">{formatarMoeda(totalVenda)}</span>
          </div>

          <button
            onClick={() => setConfirmarVenda(true)}
            disabled={carrinho.length === 0 || isFinalizando || trocoNegativo || (metodoPagamento === 'DINHEIRO' && valorRecebidoNum < totalVenda)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <CreditCard className="w-5 h-5" />
            {isFinalizando ? 'PROCESSANDO...' : 'FINALIZAR VENDA'}
          </button>
        </div>
      </div>

      {/* Modal de confirmação */}
      {confirmarVenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="w-full max-w-md p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50"></div>
            {/* Modal Content */}
            <div className="relative z-50 bg-white rounded-lg shadow-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirmar Venda</h3>
                  <div className="space-y-4 text-slate-600">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="font-bold text-emerald-600">{formatarMoeda(totalVenda)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Forma de pagamento:</span>
                      <span className="font-bold text-slate-900">{metodoPagamento}</span>
                    </div>
                    {metodoPagamento === 'DINHEIRO' && (
                      <>
                        <div className="flex justify-between">
                          <span>Valor recebido:</span>
                          <span className="font-bold text-slate-900">
                            {valorRecebidoNum > 0 ? formatarMoeda(valorRecebidoNum) : '0,00'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Troco:</span>
                          <span className={`font-bold ${trocoNegativo ? 'text-red-500' : 'text-emerald-600'}`}>
                            {formatarMoeda(troco)}
                          </span>
                        </div>
                      </>
                    )}
                    {!trocoNegativo && (
                      <div className="flex justify-between">
                        <span>Itens:</span>
                        <span className="font-bold text-slate-900">
                          {carrinho.length} item{carrinho.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  {trocoNegativo && (
                    <p className="mt-3 text-red-500 font-medium text-sm">
                      Atenção: O valor recebido é menor que o total da venda!
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmarVenda(false)}
                  className="px-5 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setConfirmarVenda(false);
                    finalizarVenda();
                  }}
                  disabled={isFinalizando}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isFinalizando ? (
                    <span className="flex items-center space-x-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l4 4 4-4-2-2-2-2M12 14l-4-4 4-4" />
                      </svg>
                      Processando...
                    </span>
                  ) : (
                    'Confirmar Venda'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}