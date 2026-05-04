// src/app/(dashboard)/estoque/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Produto, Loja } from '@/types';
import {
  Package, Plus, Search, Barcode,
  DollarSign, Store as StoreIcon, Edit, X, ImageIcon,
  TrendingDown, AlertCircle
} from 'lucide-react';
import { uploadImage } from '@/lib/storage';
// Corrigi a importação do formatarMoeda para não quebrar se não existir na lib
import { toast } from 'sonner';

export default function EstoquePage() {
  const { perfil } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [preco, setPreco] = useState('');
  const [margemSugerida] = useState(30); 
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [lojaSelecionada, setLojaSelecionada] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = perfil?.cargo === 'Administrador';
  const podeGerenciar = isAdmin || perfil?.cargo === 'Gerente';

  // 1. A VACINA DO LOOP INFINITO: Dependemos apenas do ID, não do objeto inteiro
  useEffect(() => {
    if (perfil?.id) {
      fetchData();
    }
  }, [perfil?.id]);

  // 2. A VACINA DO TRAVAMENTO: Bloco try/catch/finally
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("📦 Iniciando busca de dados do Estoque...");

      if (isAdmin) {
        const { data: lojasData, error: errLojas } = await supabase.from('lojas').select('*');
        if (errLojas) throw errLojas;
        if (lojasData) setLojas(lojasData);
      }

      let query = supabase.from('produtos').select('*, lojas(nome)').order('nome');
      if (!isAdmin && perfil?.loja_id) {
        query = query.eq('loja_id', perfil.loja_id);
      }

      const { data: produtosData, error: errProdutos } = await query;
      if (errProdutos) throw errProdutos;
      
      if (produtosData) setProdutos(produtosData as any);
      console.log("✅ Estoque carregado com sucesso!");

    } catch (error: any) {
      console.error("❌ Falha ao carregar Estoque:", error.message);
      toast.error("Erro ao comunicar com o banco de dados.");
    } finally {
      // O FINALLY GARANTE QUE A TELA DESTRAVE
      setLoading(false);
    }
  };

  const handlePrecoCustoChange = (valor: string) => {
    setPrecoCusto(valor);
    if (!editingId) {
      const custo = parseFloat(valor.replace(',', '.'));
      if (!isNaN(custo) && custo > 0) {
        const precoSugerido = custo * (1 + margemSugerida / 100);
        setPreco(precoSugerido.toFixed(2).replace('.', ','));
      }
    }
  };

  const handleSaveProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const targetLojaId = isAdmin ? lojaSelecionada : perfil?.loja_id;
      if (!targetLojaId) throw new Error('Selecione uma loja.');

      let publicUrl = '';
      if (imageFile) {
        publicUrl = await uploadImage(imageFile, 'produtos');
      }

      const precoNumerico = parseFloat(preco.replace(',', '.'));
      const precoCustoNumerico = parseFloat(precoCusto.replace(',', '.'));
      const estoqueNumerico = parseInt(estoqueAtual, 10);

      if (isNaN(precoNumerico) || precoNumerico <= 0) throw new Error('Preço de venda inválido.');
      if (isNaN(precoCustoNumerico) || precoCustoNumerico < 0) throw new Error('Preço de custo inválido.');
      if (isNaN(estoqueNumerico) || estoqueNumerico < 0) throw new Error('Quantidade inválida.');

      const payload: Partial<Produto> = {
        nome,
        codigo_barras: codigoBarras || null,
        preco: precoNumerico,
        preco_custo: precoCustoNumerico,
        loja_id: targetLojaId,
        ativo: true,
      };

      if (!editingId) {
        (payload as any).estoque_atual = estoqueNumerico;
      }

      if (publicUrl) payload.imagem_url = publicUrl;

      if (editingId) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase.from('produtos').insert([payload]);
        if (error) throw error;
        toast.success('Produto cadastrado!');
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDesativar = async (produto: Produto) => {
    const acao = produto.ativo ? 'desativar' : 'reativar';
    if (!confirm(`Deseja ${acao} o produto "${produto.nome}"?`)) return;

    const { error } = await supabase
      .from('produtos')
      .update({ ativo: !produto.ativo })
      .eq('id', produto.id);

    if (!error) {
      fetchData();
      toast.success(`Produto ${produto.ativo ? 'desativado' : 'reativado'} com sucesso!`);
    } else {
      toast.error('Erro ao alterar status do produto.');
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingId(produto.id);
    setNome(produto.nome);
    setCodigoBarras(produto.codigo_barras || '');
    setPreco(produto.preco.toString().replace('.', ','));
    setPrecoCusto(produto.preco_custo.toString().replace('.', ','));
    setEstoqueAtual(produto.estoque_atual.toString());
    setLojaSelecionada(produto.loja_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setCodigoBarras('');
    setPreco('');
    setPrecoCusto('');
    setEstoqueAtual('');
    setImageFile(null);
    if (isAdmin) setLojaSelecionada('');
  };

  const calcularMargem = (produto: Produto): number | null => {
    if (!produto.preco_custo || produto.preco_custo === 0) return null;
    return ((produto.preco - produto.preco_custo) / produto.preco_custo) * 100;
  };

  const produtosFiltrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(searchTerm))
  );

  const formatarMoedaLocal = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Package className="w-8 h-8 text-emerald-600" />
          Estoque
        </h1>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar produto ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {podeGerenciar && (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                  {editingId ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                {editingId && (
                  <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProduto} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900"
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
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Preço de Custo (R$)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={precoCusto}
                        onChange={(e) => handlePrecoCustoChange(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      Preço de Venda (R$)
                      {!editingId && precoCusto && (
                        <span className="text-[10px] text-emerald-600 font-normal">
                          Sugestão: {margemSugerida}% de margem
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500" />
                      <input
                        type="text"
                        required
                        value={preco}
                        onChange={(e) => setPreco(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantidade em Estoque
                    {editingId && <span className="text-[10px] text-slate-400 ml-1">(somente leitura na edição)</span>}
                  </label>
                  <input
                    type="number"
                    required={!editingId}
                    disabled={!!editingId}
                    min="0"
                    value={estoqueAtual}
                    onChange={(e) => setEstoqueAtual(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {editingId && (
                    <p className="text-xs text-slate-400 mt-1">
                      O estoque é gerenciado automaticamente pelas vendas.
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imagem do Produto</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-emerald-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <ImageIcon className="mx-auto h-10 w-10 text-slate-400" />
                      <label className="relative cursor-pointer font-medium text-emerald-600 hover:text-emerald-500 text-sm">
                        <span>Upload arquivo</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <p className="text-xs text-slate-500">{imageFile ? imageFile.name : 'PNG, JPG, WEBP até 2MB'}</p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 rounded-lg font-bold text-white transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
                >
                  {isSubmitting ? 'Processando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${podeGerenciar ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700">
              <tr>
                <th className="p-4">Item</th>
                <th className="p-4">Custo</th>
                <th className="p-4">Venda / Margem</th>
                <th className="p-4">Estoque</th>
                {podeGerenciar && <th className="p-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                      Carregando catálogo...
                    </div>
                  </td>
                </tr>
              ) : produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    {searchTerm ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado nesta loja.'}
                  </td>
                </tr>
              ) : produtosFiltrados.map((produto) => {
                const margem = calcularMargem(produto);
                return (
                  <tr key={produto.id} className={`hover:bg-slate-50 transition-colors ${!produto.ativo ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 overflow-hidden">
                          {produto.imagem_url ? (
                            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 m-2.5 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{produto.nome}</p>
                          <p className="text-xs text-slate-500 font-mono">{produto.codigo_barras || 'S/ REF'}</p>
                          {!produto.ativo && (
                            <span className="text-[10px] text-red-500 font-bold uppercase">Inativo</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {podeGerenciar ? formatarMoedaLocal(produto.preco_custo) : '—'}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-700">{formatarMoedaLocal(produto.preco)}</p>
                      {podeGerenciar && margem !== null && (
                        <span className={`text-xs font-semibold ${margem >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {margem.toFixed(0)}% margem
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        produto.estoque_atual === 0 ? 'bg-red-100 text-red-700' :
                        produto.estoque_atual <= 5 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {produto.estoque_atual === 0 ? 'Esgotado' : `${produto.estoque_atual} un`}
                      </span>
                    </td>
                    {podeGerenciar && (
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(produto)}
                            className="p-2 text-slate-400 hover:text-amber-500"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDesativar(produto)}
                            className={`p-2 ${produto.ativo ? 'text-slate-400 hover:text-red-500' : 'text-emerald-400 hover:text-emerald-600'}`}
                            title={produto.ativo ? 'Desativar produto' : 'Reativar produto'}
                          >
                            <TrendingDown className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}