import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, Wrench } from "lucide-react";
import { supabase } from "../lib/supabase";

type Mode = "login" | "recover" | "update";

export function AuthScreen({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<Mode>(recovery ? "update" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else if (mode === "recover") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setMessage("Te enviamos un enlace para restablecer la contraseña.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Contraseña actualizada correctamente.");
        window.setTimeout(() => changeMode("login"), 1200);
      }
    } catch (caught) {
      const rawMessage = caught instanceof Error ? caught.message : "No fue posible completar la solicitud.";
      const translations: Record<string, string> = {
        "Invalid login credentials": "Correo o contraseña incorrectos.",
        "Email not confirmed": "Debes confirmar tu correo antes de ingresar.",
        "User already registered": "Ya existe una cuenta con este correo.",
        "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres.",
      };
      setError(translations[rawMessage] ?? rawMessage);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? "Iniciar sesión"
    : mode === "recover" ? "Recuperar contraseña"
    : "Definir nueva contraseña";

  return (
    <main className="min-h-screen bg-[#eef3f8] grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:flex bg-[#1a3558] text-white p-14 xl:p-20 flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-[#f97316]/10" />
        <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#f97316] grid place-items-center"><Wrench size={22} /></div>
          <div><p className="font-bold text-xl">Gestor de Servicios</p><p className="text-blue-200 text-sm">Control técnico y financiero</p></div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-[#fb923c] text-sm font-semibold tracking-widest uppercase mb-4">Tu operación, bajo control</p>
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight">Trabajos, equipos y cobros en un solo lugar.</h1>
          <p className="mt-6 text-blue-100 text-lg leading-relaxed">Registra cada servicio desde el celular, conserva el historial técnico y controla lo que está pendiente por facturar y cobrar.</p>
        </div>
        <p className="relative text-sm text-blue-300">Acceso privado para tu empresa</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-[#f97316] text-white grid place-items-center"><Wrench size={20} /></div>
            <div><p className="font-bold text-[#1a3558]">Gestor de Servicios</p><p className="text-xs text-slate-500">Control técnico y financiero</p></div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="h-11 w-11 bg-blue-50 text-[#1a3558] rounded-xl grid place-items-center mb-5"><LockKeyhole size={21} /></div>
            <h2 className="text-2xl font-bold text-[#132b49]">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "recover" ? "Escribe el correo asociado a tu cuenta."
                : mode === "update" ? "Usa al menos 10 caracteres para proteger tu cuenta."
                : "Ingresa con el correo registrado en el sistema."}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode !== "update" && (
                <label className="block text-sm font-semibold text-slate-700">Correo electrónico
                  <div className="relative mt-1.5"><Mail className="absolute left-3 top-3 text-slate-400" size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full h-11 rounded-lg border border-slate-300 bg-white pl-10 pr-3 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" placeholder="nombre@correo.com" /></div>
                </label>
              )}
              {(mode === "login" || mode === "update") && (
                <label className="block text-sm font-semibold text-slate-700">{mode === "update" ? "Nueva contraseña" : "Contraseña"}
                  <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3 text-slate-400" size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "update" ? 10 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} className="w-full h-11 rounded-lg border border-slate-300 bg-white pl-10 pr-11 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100" placeholder={mode === "update" ? "Mínimo 10 caracteres" : "Contraseña"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </label>
              )}

              {error && <div role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{error}</div>}
              {message && <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={18} className="shrink-0" />{message}</div>}

              <button disabled={loading} className="w-full h-11 rounded-lg bg-[#f97316] hover:bg-orange-600 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {mode === "login" ? "Ingresar" : mode === "recover" ? "Enviar enlace" : "Guardar contraseña"}
              </button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 text-sm">
              {mode === "login" && <button onClick={() => changeMode("recover")} className="text-[#1a3558] hover:underline">¿Olvidaste tu contraseña?</button>}
              {mode !== "login" && mode !== "update" && <button onClick={() => changeMode("login")} className="text-[#1a3558] hover:underline">Volver al inicio de sesión</button>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
