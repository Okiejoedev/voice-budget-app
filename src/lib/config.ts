// Public project settings. The publishable key is designed to be shipped in frontend code:
// Row Level Security in the database is what protects each user's data.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://maqsukzzzmxntxvzhtpy.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_0tmxQXqGYcpFkHkdeqn5Mw_a2USZ-RF';
