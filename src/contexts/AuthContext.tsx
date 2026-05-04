// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Perfil } from '@/types';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextData {
  user: any | null;
  perfil: Perfil | null;
  loading: boolean;
  lojaSuspensa: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [lojaSuspensa, setLojaSuspensa] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // Função única e blindada para carregar todo o contexto do usuário
  const loadPerfilCompleto = useCallback(async (userId: string) => {
    try {
      const { data: pData, error: pError } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();

      if (pError || !pData) throw pError;

      const p = pData as Perfil;
      setPerfil(p);

      // Regra de suspensão: Admin nunca é bloqueado
      if (p.loja_id && p.cargo !== 'Administrador') {
        const { data: loja } = await supabase
          .from('lojas')
          .select('ativa')
          .eq('id', p.loja_id)
          .single();
        
        setLojaSuspensa(loja?.ativa === false);
      } else {
        setLojaSuspensa(false);
      }
    } catch (err) {
      console.error("Erro ao sincronizar perfil/loja:", err);
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (mounted && session?.user) {
        setUser(session.user);
        await loadPerfilCompleto(session.user.id);
      }
      if (mounted) setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (session?.user) {
          setUser(session.user);
          setLoading(true);
          await loadPerfilCompleto(session.user.id);
          setLoading(false);
        } else {
          setUser(null);
          setPerfil(null);
          setLojaSuspensa(false);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadPerfilCompleto]);

  // Controlador de Tráfego Automático
  useEffect(() => {
    if (loading) return;

    if (lojaSuspensa && pathname !== '/suspensa') {
      router.replace('/suspensa'); // Use replace para não criar histórico da página bloqueada
    } else if (!lojaSuspensa && pathname === '/suspensa' && perfil) {
      router.replace('/');
    } else if (perfil?.cargo === 'Colaborador' && pathname === '/') {
      router.replace('/pdv');
    }
  }, [perfil, lojaSuspensa, pathname, loading, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, perfil, loading, lojaSuspensa, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);