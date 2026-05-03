// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, ShoppingCart, Package, Users, Store, LogOut } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { perfil, signOut } = useAuth();

  // Esconde a sidebar se não tiver perfil carregado
  if (!perfil) return null;

  const isAdmin = perfil.cargo === 'Administrador';

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'PDV (Caixa)', href: '/pdv', icon: ShoppingCart },
    { name: 'Estoque', href: '/estoque', icon: Package },
    { name: 'Colaboradores', href: '/colaboradores', icon: Users },
    // Apenas Admin vê a gestão de Lojas
    ...(isAdmin ? [{ name: 'Lojas', href: '/lojas', icon: Store }] : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-emerald-400">PDV Pro</h2>
        <p className="text-xs mt-1 text-slate-500">
          {perfil.cargo} {isAdmin ? '(Global)' : ''}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-emerald-600 text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}