// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Inicializa a resposta que será modificada e retornada
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Cria o cliente Supabase para o lado do servidor
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // IMPORTANTE: Só atualizamos se houver mudança real
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          // Criamos a resposta baseada na requisição atualizada
          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica o usuário logado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')

  // Regra 1: Se não tem usuário logado e não está na tela de login -> Manda pro Login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Regra 2: Se tem usuário logado e tenta acessar o Login -> Manda pro PDV (raiz)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Configuração de onde o middleware deve rodar
export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas, EXCETO:
     * - Arquivos estáticos (_next/static)
     * - Otimização de imagens (_next/image)
     * - Favicon e extensões de imagem comuns
     */
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',  ],
}