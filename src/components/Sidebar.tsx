// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  LogOut,
  BarChart3,
  User as UserIcon,
  ShieldAlert
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { perfil, signOut } = useAuth();

  if (!perfil) return null;

  const isAdmin = perfil.cargo === 'Administrador';
  const isGestor = isAdmin || perfil.cargo === 'Gerente';

  const menuItems = [
    // Dashboard: apenas gestores
    ...(isGestor ? [{ name: 'Dashboard', href: '/', icon: LayoutDashboard }] : []),

    // PDV e Estoque: todos
    { name: 'PDV (Caixa)', href: '/pdv', icon: ShoppingCart },
    { name: 'Estoque', href: '/estoque', icon: Package },

    // Relatórios: apenas gestores
    ...(isGestor ? [{ name: 'Relatórios', href: '/relatorios', icon: BarChart3 }] : []),

    // Colaboradores: apenas gestores
    ...(isGestor ? [{ name: 'Equipe', href: '/colaboradores', icon: Users }] : []),

    // Admin exclusivo
    ...(isAdmin ? [
      { name: 'Lojas', href: '/lojas', icon: Store },
      { name: 'Admin Master', href: '/admin/lojas', icon: ShieldAlert },
    ] : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-2xl font-black text-emerald-400 tracking-tight">PDV Pro</h2>
        <div className="flex items-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-purple-500' : perfil.cargo === 'Gerente' ? 'bg-blue-400' : 'bg-emerald-500'}`}></span>
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
            {perfil.cargo}
          </p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`} />
              <span className="font-semibold text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
            {perfil.avatar_url ? (
              <img src={perfil.avatar_url} alt={perfil.nome} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-5 h-5 m-2 text-slate-500" />
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-slate-200 truncate">{perfil.nome}</p>
            <p className="text-[10px] text-slate-500 truncate">Sessão ativa</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
