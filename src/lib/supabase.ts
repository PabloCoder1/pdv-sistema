import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Este cliente será usado para chamadas no lado do cliente (navegador)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);