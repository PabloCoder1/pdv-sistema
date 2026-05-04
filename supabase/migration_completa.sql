-- ============================================================
-- PDV SISTEMA — MIGRATION COMPLETA
-- Execute no Supabase: SQL Editor → New Query → Cole tudo → Run
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- PARTE 1: ALTERAÇÕES NAS TABELAS EXISTENTES
-- ────────────────────────────────────────────────────────────

-- 1.1 itens_venda: adiciona snapshot de preco_custo
-- (campo existia no código mas não na tabela — confirmar na imagem)
ALTER TABLE itens_venda
  ADD COLUMN IF NOT EXISTS preco_custo NUMERIC NOT NULL DEFAULT 0;

-- 1.2 vendas: adiciona campos de status, desconto e valor recebido
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'concluida'
    CHECK (status IN ('concluida', 'cancelada')),
  ADD COLUMN IF NOT EXISTS desconto NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_recebido NUMERIC NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- PARTE 2: RPC — processar_venda (transação atômica)
-- Substitui as 3 operações separadas do frontend por 1 chamada
-- garantindo que estoque e venda nunca fiquem inconsistentes
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION processar_venda(
  p_loja_id      UUID,
  p_usuario_id   UUID,
  p_total        NUMERIC,
  p_metodo_pagamento TEXT,
  p_valor_recebido   NUMERIC,
  p_itens        JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id     UUID;
  v_item         JSONB;
  v_produto_id   UUID;
  v_quantidade   INT;
  v_estoque_atual INT;
  v_nome_produto TEXT;
BEGIN
  -- PASSO 1: Verifica estoque de TODOS os itens antes de qualquer mudança
  -- Se qualquer item falhar, a transação inteira é revertida
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id  := (v_item->>'produto_id')::UUID;
    v_quantidade  := (v_item->>'quantidade')::INT;

    SELECT estoque_atual, nome
      INTO v_estoque_atual, v_nome_produto
      FROM produtos
     WHERE id = v_produto_id
       AND loja_id = p_loja_id
       AND ativo = TRUE
    FOR UPDATE; -- Bloqueia a linha para evitar race condition

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo.';
    END IF;

    IF v_estoque_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%". Disponível: % unidade(s).', 
        v_nome_produto, v_estoque_atual;
    END IF;
  END LOOP;

  -- PASSO 2: Cria a venda
  INSERT INTO vendas (loja_id, usuario_id, total, metodo_pagamento, valor_recebido, status)
  VALUES (p_loja_id, p_usuario_id, p_total, p_metodo_pagamento, p_valor_recebido, 'concluida')
  RETURNING id INTO v_venda_id;

  -- PASSO 3: Insere itens e baixa estoque atomicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item->>'produto_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INT;

    -- Insere item com snapshot de preco_custo
    INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, preco_custo, subtotal)
    VALUES (
      v_venda_id,
      v_produto_id,
      v_quantidade,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'preco_custo')::NUMERIC,   -- snapshot do custo no momento da venda
      (v_item->>'subtotal')::NUMERIC
    );

    -- Baixa o estoque
    UPDATE produtos
       SET estoque_atual = estoque_atual - v_quantidade
     WHERE id = v_produto_id;
  END LOOP;

  RETURN v_venda_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro reverte TUDO automaticamente (ACID)
    RAISE;
END;
$$;

-- Garante que apenas usuários autenticados chamem a RPC
REVOKE ALL ON FUNCTION processar_venda FROM PUBLIC;
GRANT EXECUTE ON FUNCTION processar_venda TO authenticated;


-- ────────────────────────────────────────────────────────────
-- PARTE 3: ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Habilita RLS em todas as tabelas (se ainda não estiver)
ALTER TABLE lojas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis       ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda  ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas para recriar limpas
DROP POLICY IF EXISTS "lojas_admin_all"         ON lojas;
DROP POLICY IF EXISTS "lojas_select_propria"    ON lojas;
DROP POLICY IF EXISTS "perfis_admin_all"        ON perfis;
DROP POLICY IF EXISTS "perfis_gestor_select"    ON perfis;
DROP POLICY IF EXISTS "perfis_select_proprio"   ON perfis;
DROP POLICY IF EXISTS "produtos_admin_all"      ON produtos;
DROP POLICY IF EXISTS "produtos_loja"           ON produtos;
DROP POLICY IF EXISTS "vendas_admin_all"        ON vendas;
DROP POLICY IF EXISTS "vendas_loja"             ON vendas;
DROP POLICY IF EXISTS "itens_venda_acesso"      ON itens_venda;

-- ── LOJAS ──────────────────────────────────────────────────
-- Admin vê e gerencia todas
CREATE POLICY "lojas_admin_all" ON lojas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
       WHERE perfis.id = auth.uid()
         AND perfis.cargo = 'Administrador'
    )
  );

-- Gerente e Colaborador veem apenas a própria loja
CREATE POLICY "lojas_select_propria" ON lojas
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT loja_id FROM perfis WHERE perfis.id = auth.uid()
    )
  );

-- ── PERFIS ─────────────────────────────────────────────────
-- Admin vê e gerencia todos
CREATE POLICY "perfis_admin_all" ON perfis
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis p
       WHERE p.id = auth.uid()
         AND p.cargo = 'Administrador'
    )
  );

-- Gerente vê perfis da própria loja
CREATE POLICY "perfis_gestor_select" ON perfis
  FOR SELECT
  TO authenticated
  USING (
    loja_id = (
      SELECT p.loja_id FROM perfis p
       WHERE p.id = auth.uid()
         AND p.cargo = 'Gerente'
    )
  );

-- Qualquer usuário vê o próprio perfil
CREATE POLICY "perfis_select_proprio" ON perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ── PRODUTOS ───────────────────────────────────────────────
-- Admin gerencia todos
CREATE POLICY "produtos_admin_all" ON produtos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
       WHERE perfis.id = auth.uid()
         AND perfis.cargo = 'Administrador'
    )
  );

-- Gerente e Colaborador acessam apenas produtos da própria loja
CREATE POLICY "produtos_loja" ON produtos
  FOR ALL
  TO authenticated
  USING (
    loja_id = (
      SELECT perfis.loja_id FROM perfis
       WHERE perfis.id = auth.uid()
    )
  );

-- ── VENDAS ─────────────────────────────────────────────────
-- Admin vê todas
CREATE POLICY "vendas_admin_all" ON vendas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
       WHERE perfis.id = auth.uid()
         AND perfis.cargo = 'Administrador'
    )
  );

-- Gerente e Colaborador veem vendas da própria loja
CREATE POLICY "vendas_loja" ON vendas
  FOR ALL
  TO authenticated
  USING (
    loja_id = (
      SELECT perfis.loja_id FROM perfis
       WHERE perfis.id = auth.uid()
    )
  );

-- ── ITENS_VENDA ────────────────────────────────────────────
-- Acesso via venda da própria loja
CREATE POLICY "itens_venda_acesso" ON itens_venda
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendas v
        JOIN perfis p ON p.id = auth.uid()
       WHERE v.id = itens_venda.venda_id
         AND (
           p.cargo = 'Administrador'
           OR v.loja_id = p.loja_id
         )
    )
  );


-- ────────────────────────────────────────────────────────────
-- PARTE 4: STORAGE — CORRIGIR BUCKETS PÚBLICOS
-- Execute via Supabase Dashboard → Storage → Policies
-- (não é possível via SQL diretamente — instruções abaixo)
-- ────────────────────────────────────────────────────────────

-- ATENÇÃO: Faça isso manualmente no Dashboard do Supabase:
--
-- 1. Vá em Storage → Buckets
-- 2. Para o bucket "produtos":
--    - Clique em "Edit"
--    - Mude o "File size limit" para 2097152 (2MB)
--    - Em "Allowed MIME types", coloque: image/jpeg,image/png,image/webp
--    - Salve
-- 3. Para o bucket "avatars":
--    - Mesma coisa: 2MB, image/jpeg,image/png,image/webp
--
-- As policies de storage abaixo podem ser aplicadas via SQL:

-- Remove policies antigas de storage
DROP POLICY IF EXISTS "produtos_upload_auth"    ON storage.objects;
DROP POLICY IF EXISTS "produtos_read_public"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload_auth"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_read_public"     ON storage.objects;

-- Bucket produtos: leitura pública, upload apenas autenticados
CREATE POLICY "produtos_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'produtos');

CREATE POLICY "produtos_upload_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produtos');

CREATE POLICY "produtos_delete_auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'produtos');

-- Bucket avatars: leitura pública, upload apenas autenticados
CREATE POLICY "avatars_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_upload_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_delete_auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');


-- ────────────────────────────────────────────────────────────
-- PARTE 5: ÍNDICES DE PERFORMANCE
-- ────────────────────────────────────────────────────────────

-- Buscas mais comuns — aceleram dashboard e relatórios
CREATE INDEX IF NOT EXISTS idx_vendas_loja_created
  ON vendas (loja_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendas_status
  ON vendas (status);

CREATE INDEX IF NOT EXISTS idx_itens_venda_venda_id
  ON itens_venda (venda_id);

CREATE INDEX IF NOT EXISTS idx_itens_venda_produto_id
  ON itens_venda (produto_id);

CREATE INDEX IF NOT EXISTS idx_produtos_loja_ativo
  ON produtos (loja_id, ativo);

CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras
  ON produtos (codigo_barras)
  WHERE codigo_barras IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_loja_id
  ON perfis (loja_id);


-- ────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL
-- ────────────────────────────────────────────────────────────

-- Rode para confirmar que tudo foi criado corretamente:
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
