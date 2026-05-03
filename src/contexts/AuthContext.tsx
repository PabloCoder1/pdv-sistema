// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Perfil } from '@/types';

interface AuthContextData {
  user: any | null; // Dados básicos do Supabase Auth (e-mail, etc)
  perfil: Perfil | null; // Nossos dados de negócio (Cargo, Loja, etc)
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Função para carregar o Perfil da nossa tabela
    const loadPerfil = async (userId: string) => {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setPerfil(data as Perfil);
      }
    };

    // 2. Verifica a sessão atual ao abrir o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 3. Fica escutando mudanças (ex: usuário fez login ou logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadPerfil(session.user.id).then(() => setLoading(false));
        } else {
          setPerfil(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, perfil, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook customizado para usarmos em qualquer página de forma simples
export const useAuth = () => useContext(AuthContext);