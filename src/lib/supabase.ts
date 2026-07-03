import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_APP_URL: z.preprocess((value) => value || undefined, z.string().url().optional()),
});

const env = envSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
});

export const supabaseUrl = env.VITE_SUPABASE_URL;
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
export const authRedirectUrl = `${(env.VITE_APP_URL ?? window.location.origin).replace(/\/$/, "")}/`;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
