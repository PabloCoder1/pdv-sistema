// src/types/index.ts

export type Cargo = 'Administrador' | 'Gerente' | 'Colaborador';

export interface Loja {
  id: string;
  nome: string;
  endereco: string | null;
  created_at: string;
}

export interface Perfil {
  id: string;
  nome: string;
  cargo: Cargo;
  loja_id: string | null; // Null se for Admin
  created_at: string;
}

export interface Produto {
  id: string;
  loja_id: string; // Agora todo produto pertence a uma loja
  codigo_barras: string | null;
  nome: string;
  preco: number;
  estoque_atual: number;
  ativo: boolean;
  created_at: string;
}

export interface Venda {
  id: string;
  loja_id: string; // Venda atrelada ao faturamento da loja
  usuario_id: string;
  total: number;
  metodo_pagamento: string;
  created_at: string;
}

export interface ItemVenda {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}