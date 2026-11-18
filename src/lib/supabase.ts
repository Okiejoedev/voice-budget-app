import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'voice-budget-auth',
  },
});

/** Where Google sends people back to after sign-in (works on localhost and GitHub Pages). */
export function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
