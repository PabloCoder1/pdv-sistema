// src/lib/formatters.ts
// NOVO: utilitários centralizados — não duplicar formatarMoeda em cada arquivo

export const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export const formatarData = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR');

export const formatarDataHora = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR');
