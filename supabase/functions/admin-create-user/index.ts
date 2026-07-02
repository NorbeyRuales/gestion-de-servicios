import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ManagedUserRole = "admin" | "technician" | "billing";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Configuración de autenticación incompleta." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sesión no válida." }, 401);

  const { data: profile } = await callerClient
    .from("profiles")
    .select("role,is_active")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.is_active || profile.role !== "admin") {
    return json({ error: "Solo un administrador puede crear usuarios." }, 403);
  }

  let payload: { fullName?: string; email?: string; password?: string; role?: ManagedUserRole };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }

  const fullName = payload.fullName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";
  const allowedRoles: ManagedUserRole[] = ["admin", "technician", "billing"];
  if (!fullName || !email || password.length < 10 || !payload.role || !allowedRoles.includes(payload.role)) {
    return json({ error: "Nombre, correo, contraseña segura y rol son obligatorios." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? "No fue posible crear el usuario." }, 400);

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ full_name: fullName, role: payload.role, is_active: true })
    .eq("id", created.user.id);
  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: "No fue posible asignar el perfil al usuario." }, 500);
  }

  return json({ id: created.user.id }, 201);
});
