// src/app/api/usuarios/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nome, cargo, loja_id } = body;

    // Inicializa o Supabase com a chave de ADMIN (Service Role)
    // Isso permite criar usuários sem deslogar quem está fazendo a requisição
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma o email para o usuário já poder logar
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insere o perfil na nossa tabela 'perfis'
    const { error: profileError } = await supabaseAdmin
      .from('perfis')
      .insert([
        {
          id: authData.user.id,
          nome,
          cargo,
          loja_id: loja_id || null, // Se for Admin, pode ser null
        },
      ]);

    if (profileError) {
      // Rollback manual caso falhe ao criar o perfil
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Usuário criado com sucesso' }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}