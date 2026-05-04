// src/lib/storage.ts
import { supabase } from './supabase';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2MB

export async function uploadImage(file: File, bucket: 'produtos' | 'avatars'): Promise<string> {
  // CORRIGIDO: validação de tipo e tamanho antes do upload
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.');
  }

  if (file.size > TAMANHO_MAXIMO) {
    throw new Error('Arquivo muito grande. Tamanho máximo: 2MB.');
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // CORRIGIDO: crypto.randomUUID() em vez de Math.random() — sem colisão
  const fileName = `${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return publicUrl;
}
