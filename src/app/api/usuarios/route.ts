// src/app/api/usuarios/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Helper: cria o cliente admin (Service Role)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Helper: autentica quem fez a requisição e retorna seu perfil
// CORRIGIDO: autenticação real via token JWT do header Authorization
async function autenticarRequisitor(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: perfilRequisitor } = await supabaseAdmin
    .from('perfis')
    .select('id, cargo, loja_id')
    .eq('id', user.id)
    .single();

  return perfilRequisitor;
}

// ─── POST: Criar usuário ──────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    // CORRIGIDO: verifica autenticação antes de qualquer coisa
    const requisitor = await autenticarRequisitor(request);
    if (!requisitor) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    // CORRIGIDO: apenas Admin e Gerente podem criar usuários
    if (requisitor.cargo === 'Colaborador') {
      return NextResponse.json({ error: 'Sem permissão para criar usuários.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, nome, cargo, loja_id } = body;

    // CORRIGIDO: Gerente não pode criar Admin nem outro Gerente
    if (requisitor.cargo === 'Gerente') {
      if (cargo !== 'Colaborador') {
        return NextResponse.json(
          { error: 'Gerente só pode criar Colaboradores.' },
          { status: 403 }
        );
      }
      // Gerente só pode criar colaboradores na própria loja
      if (loja_id && loja_id !== requisitor.loja_id) {
        return NextResponse.json(
          { error: 'Gerente só pode criar usuários na sua própria loja.' },
          { status: 403 }
        );
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Cria o usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insere o perfil
    const { error: profileError } = await supabaseAdmin
      .from('perfis')
      .insert([{
        id: authData.user.id,
        nome,
        cargo,
        loja_id: loja_id || null,
      }]);

    if (profileError) {
      // Rollback: remove o usuário do Auth se falhou o perfil
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Usuário criado com sucesso.' }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/usuarios]', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// ─── PUT: Editar usuário ──────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    // CORRIGIDO: verifica autenticação
    const requisitor = await autenticarRequisitor(request);
    if (!requisitor) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    if (requisitor.cargo === 'Colaborador') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, email, password, nome, cargo, loja_id, avatar_url } = body;

    // CORRIGIDO: Gerente não pode promover ninguém a Gerente ou Admin
    if (requisitor.cargo === 'Gerente' && cargo !== 'Colaborador') {
      return NextResponse.json(
        { error: 'Gerente só pode gerenciar Colaboradores.' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verifica o alvo antes de editar
    const { data: perfilAlvo } = await supabaseAdmin
      .from('perfis')
      .select('cargo, loja_id')
      .eq('id', id)
      .single();

    if (!perfilAlvo) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Gerente só pode editar colaboradores da sua loja
    if (
      requisitor.cargo === 'Gerente' &&
      (perfilAlvo.cargo !== 'Colaborador' || perfilAlvo.loja_id !== requisitor.loja_id)
    ) {
      return NextResponse.json({ error: 'Sem permissão para editar este usuário.' }, { status: 403 });
    }

    // 1. Atualiza Auth (email/senha) se enviados
    const updateAuth: Record<string, string> = {};
    if (email) updateAuth.email = email;
    if (password) updateAuth.password = password;

    if (Object.keys(updateAuth).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateAuth);
      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Atualiza perfil
    const updatePerfil: Record<string, any> = { nome, cargo, loja_id: loja_id || null };
    if (avatar_url) updatePerfil.avatar_url = avatar_url;

    const { error: profileError } = await supabaseAdmin
      .from('perfis')
      .update(updatePerfil)
      .eq('id', id);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    return NextResponse.json({ message: 'Usuário atualizado com sucesso.' });

  } catch (error) {
    console.error('[PUT /api/usuarios]', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

// ─── DELETE: Remover usuário ──────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    // CORRIGIDO: verifica autenticação
    const requisitor = await autenticarRequisitor(request);
    if (!requisitor) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParaDeletar = searchParams.get('id');

    if (!idParaDeletar) {
      return NextResponse.json({ error: 'ID não informado.' }, { status: 400 });
    }

    // Não pode deletar a si mesmo
    if (idParaDeletar === requisitor.id) {
      return NextResponse.json({ error: 'Você não pode remover sua própria conta.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: perfilAlvo } = await supabaseAdmin
      .from('perfis')
      .select('cargo, loja_id')
      .eq('id', idParaDeletar)
      .single();

    if (!perfilAlvo) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const isAdmin = requisitor.cargo === 'Administrador';
    const isGerenteDono =
      requisitor.cargo === 'Gerente' &&
      requisitor.loja_id === perfilAlvo.loja_id &&
      perfilAlvo.cargo === 'Colaborador';

    if (!isAdmin && !isGerenteDono) {
      return NextResponse.json({ error: 'Sem permissão para remover este usuário.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(idParaDeletar);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ message: 'Acesso removido com sucesso.' });

  } catch (error) {
    console.error('[DELETE /api/usuarios]', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
