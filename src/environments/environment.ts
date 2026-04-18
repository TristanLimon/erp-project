export const environment = {
  production: false,

  // Project Settings → API → Project URL y anon/public key
  supabaseUrl: 'https://alpynkmdjijxtxvwtcuj.supabase.co',
  supabaseKey: 'sb_publishable_l5WyP2V1PGHbD8ngp9WEuw_mTHQKHAX',
  // REST API base URL — ahora apunta al backend local (API Gateway Express)
  apiBaseUrl: 'http://localhost:3000/api',
  // Auth API base URL (sigue usando Supabase Auth SDK directamente)
  authBaseUrl: 'https://alpynkmdjijxtxvwtcuj.supabase.co/auth/v1',
};
