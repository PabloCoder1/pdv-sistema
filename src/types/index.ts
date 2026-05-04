// src/types/index.ts

export type Cargo = 'Administrador' | 'Gerente' | 'Colaborador';

export interface Loja {
  id: string;
  nome: string;
  endereco: string | null;
  created_at: string;
  ativa: boolean; // CORRIGIDO: campo existia no banco mas faltava no tipo
}

export interface Perfil {
  id: string;
  nome: string;
  cargo: Cargo;
  loja_id?: string | null;
  avatar_url?: string | null;
  ativo?: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  codigo_barras?: string | null;
  preco: number;
  preco_custo: number;
  estoque_atual: number;
  loja_id: string;
  ativo: boolean;
  imagem_url?: string | null;
  created_at?: string;
}

export interface Venda {
  id: string;
  loja_id: string;
  usuario_id: string;
  total: number;
  desconto: number;       // NOVO: suporte a desconto
  metodo_pagamento: string;
  valor_recebido?: number; // NOVO: para cálculo de troco
  status: 'concluida' | 'cancelada'; // NOVO: status da venda
  created_at: string;
}

export interface ItemVenda {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  preco_custo: number;    // NOVO: snapshot do custo no momento da venda
  subtotal: number;
}

// Payload enviado para a RPC de venda atômica
export interface ItemVendaPayload {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  preco_custo: number;
  subtotal: number;
}
