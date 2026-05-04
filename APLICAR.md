# PDV Sistema — Guia de Aplicação das Correções

## Estrutura dos arquivos gerados

```
pdv-corrigido/
├── src/
│   ├── types/
│   │   └── index.ts                          ← tipos corrigidos
│   ├── lib/
│   │   ├── formatters.ts                     ← NOVO: utilitários centralizados
│   │   └── storage.ts                        ← UUID + validação de arquivo
│   ├── contexts/
│   │   └── AuthContext.tsx                   ← kill switch no contexto
│   ├── components/layout/
│   │   ├── Sidebar.tsx                       ← menu por cargo corrigido
│   │   └── LojaSuspensaGuard.tsx             ← NOVO: tela de loja suspensa
│   └── app/
│       ├── (dashboard)/
│       │   ├── layout.tsx                    ← integra o guard
│       │   ├── page.tsx                      ← dashboard com filtro de data
│       │   ├── pdv/page.tsx                  ← RPC atômica + troco + barcode
│       │   ├── estoque/page.tsx              ← preco_custo + soft delete + margem
│       │   ├── relatorios/page.tsx           ← snapshot de custo + filtro de período
│       │   ├── colaboradores/page.tsx        ← token JWT + validação de cargo
│       │   └── admin/lojas/page.tsx          ← kill switch funcional
│       └── api/usuarios/
│           └── route.ts                      ← autenticação + autorização completa
└── supabase/
    └── migration_completa.sql                ← tudo que precisa no banco
```

---

## Passo a passo para aplicar

### 1. Banco de dados (Supabase) — FAZER PRIMEIRO

1. Acesse o **Supabase Dashboard** da sua conta
2. Vá em **SQL Editor → New query**
3. Cole o conteúdo completo de `supabase/migration_completa.sql`
4. Clique em **Run**
5. Verifique se não houve erros no output
6. Execute a query de verificação no final do arquivo para confirmar as policies

> **Atenção:** Se aparecer erro em `CREATE POLICY` dizendo que a policy já existe, rode o bloco `DROP POLICY IF EXISTS` primeiro e depois rode de novo.

### 2. Configurar os buckets manualmente (não tem SQL)

No Supabase Dashboard → **Storage → Buckets**:

Para os buckets `avatars` e `produtos`:
- Clique no bucket → **Edit**
- File size limit: `2097152` (2MB em bytes)
- Allowed MIME types: `image/jpeg,image/png,image/webp`
- Salve

### 3. Substituir os arquivos do projeto

Copie cada arquivo de `pdv-corrigido/src/` para o local equivalente no seu projeto.

Ordem recomendada para evitar erros de TypeScript durante a substituição:

```
1. src/types/index.ts
2. src/lib/formatters.ts          (novo — criar)
3. src/lib/storage.ts
4. src/contexts/AuthContext.tsx
5. src/components/layout/LojaSuspensaGuard.tsx   (novo — criar)
6. src/components/layout/Sidebar.tsx
7. src/app/(dashboard)/layout.tsx
8. src/app/(dashboard)/page.tsx
9. src/app/(dashboard)/pdv/page.tsx
10. src/app/(dashboard)/estoque/page.tsx
11. src/app/(dashboard)/relatorios/page.tsx
12. src/app/(dashboard)/colaboradores/page.tsx
13. src/app/(dashboard)/admin/lojas/page.tsx
14. src/app/api/usuarios/route.ts
```

### 4. Verificar variáveis de ambiente

Certifique-se de que seu `.env.local` tem:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...   ← necessária para a API route
```

A `SERVICE_ROLE_KEY` está no Supabase → **Settings → API → service_role**. Nunca exponha ela no frontend.

### 5. Testar após aplicar

Checklist de testes mínimos:

- [ ] Login com colaborador → não vê Dashboard nem Relatórios na sidebar
- [ ] Login com colaborador → acessa `/` diretamente → vê tela de "acesso restrito"
- [ ] Criar usuário sem estar logado → API retorna 401
- [ ] Gerente tenta criar Gerente via API → retorna 403
- [ ] Cadastrar produto com custo → preço de venda é sugerido automaticamente
- [ ] Fazer venda com 1 unidade restante → não permite adicionar mais
- [ ] Verificar no banco após venda: `itens_venda.preco_custo` está preenchido
- [ ] Suspender loja → usuário da loja vê tela "Acesso Suspenso" ao tentar acessar

---

## Resumo das correções por arquivo

### `route.ts` (API de usuários)
- ✅ Autenticação via token JWT em todos os métodos (GET, POST, PUT, DELETE)
- ✅ Gerente só pode criar/editar/remover Colaboradores
- ✅ Gerente só pode operar na sua própria loja
- ✅ Ninguém pode excluir a própria conta

### `AuthContext.tsx`
- ✅ Verifica se a loja do usuário está ativa após carregar o perfil
- ✅ Expõe `lojaSuspensa` para uso no layout

### `LojaSuspensaGuard.tsx` (novo)
- ✅ Bloqueia toda a área do dashboard se `lojaSuspensa === true`

### `admin/lojas/page.tsx`
- ✅ Botão de kill switch altera `lojas.ativa` no banco
- ✅ Badge de status correto (Ativa / Suspensa)
- ✅ Aviso visual sobre consequências da suspensão

### `pdv/page.tsx`
- ✅ Chama a RPC `processar_venda` (transação atômica)
- ✅ Campo de valor recebido e cálculo de troco
- ✅ Suporte a leitor de código de barras (Enter no campo de busca)
- ✅ Alerta visual de estoque baixo (≤5 unidades)

### `estoque/page.tsx`
- ✅ Campo `preco_custo` no formulário
- ✅ Sugestão automática de preço de venda por margem (30%)
- ✅ Soft delete: desativa produto em vez de deletar
- ✅ Coluna de margem visível para gestores
- ✅ Custo de custo oculto para colaboradores

### `relatorios/page.tsx`
- ✅ Filtro de período (7 dias / 30 dias / mês atual)
- ✅ Usa `itens_venda.preco_custo` (snapshot) para calcular lucro
- ✅ Filtra por `status = 'concluida'`

### `page.tsx` (dashboard)
- ✅ Colaboradores veem tela de acesso negado
- ✅ Filtra apenas vendas do mês atual

### `Sidebar.tsx`
- ✅ Colaboradores não veem Dashboard, Relatórios nem Equipe
- ✅ Indicador de cor por cargo (purple/Admin, blue/Gerente, green/Colaborador)

### `formatters.ts` (novo)
- ✅ `formatarMoeda`, `formatarData`, `formatarDataHora` centralizadas

### `storage.ts`
- ✅ Validação de tipo MIME antes do upload
- ✅ Limite de 2MB no frontend
- ✅ `crypto.randomUUID()` em vez de `Math.random()`

### `types/index.ts`
- ✅ `Loja.ativa: boolean` adicionado
- ✅ `Venda.status`, `Venda.desconto`, `Venda.valor_recebido`
- ✅ `ItemVenda.preco_custo` (snapshot)
- ✅ Tipos estritos em todo lugar

### `migration_completa.sql`
- ✅ `itens_venda.preco_custo` adicionado
- ✅ `vendas.status`, `vendas.desconto`, `vendas.valor_recebido`
- ✅ RPC `processar_venda` (transação ACID completa)
- ✅ RLS habilitado e policies corretas para todas as tabelas
- ✅ Policies de storage para buckets
- ✅ Índices de performance
