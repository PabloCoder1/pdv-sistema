import { createBrowserClient } from '@supabase/ssr';

// Usamos o createBrowserClient para que ele gerencie os Cookies automaticamente
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);