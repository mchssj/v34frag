import { createApp } from '../src/app';

// Variables mínimas válidas para las pruebas unitarias (no se conectan a nada).
export const testEnv = (over: Record<string, string | undefined> = {}) => ({
  APP_ENV: 'test',
  SUPABASE_URL: 'http://supabase.test',
  SUPABASE_ANON_KEY: 'anon-key-de-prueba-1234567890',
  CORS_ORIGINS: 'https://csstv.pages.dev,https://*.csstv.pages.dev,http://localhost:*',
  FRONTEND_URL: 'https://csstv.pages.dev',
  GIT_SHA: 'abc1234',
  ...over,
});

export const makeApp = () => createApp();

export async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
