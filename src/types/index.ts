// src/types/index.ts

export type Cargo = 'Administrador' | 'Gerente' | 'Colaborador';

export interface Perfil {
  id: string;
  nome: string;
  cargo: Cargo;
  created_at: string;
}

export interface Produto {
  id: string;
  codigo_barras: string | null;
  nome: string;
  preco: number;
  estoque_atual: number;
  ativo: boolean;
  created_at: string;
}

export interface Venda {
  id: string;
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