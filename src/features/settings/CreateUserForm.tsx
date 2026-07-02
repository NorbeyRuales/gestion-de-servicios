import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { createManagedUser, type ManagedUserRole } from "./userAdminApi";

interface CreateUserFormProps {
  onCancel: () => void;
  onCreated: () => Promise<void>;
}

const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

export function CreateUserForm({ onCancel, onCreated }: CreateUserFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedUserRole>("technician");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (fullName.trim().length < 2) return setError("Escribe el nombre completo.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Escribe un correo válido.");
    if (password.length < 8) return setError("La contraseña temporal debe tener al menos 8 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");

    setSaving(true);
    try {
      await createManagedUser({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password, role });
      await onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  return <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h3 className="font-bold">Crear usuario</h3><p className="text-xs text-muted-foreground">El correo quedará confirmado y podrá ingresar inmediatamente con la contraseña temporal.</p></div>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground">Cancelar</button>
    </div>
    {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} className="shrink-0" />{error}</div>}
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold">Nombre completo<input autoFocus className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
      <label className="text-sm font-semibold">Correo electrónico<input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label className="text-sm font-semibold">Rol<select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as ManagedUserRole)}><option value="technician">Técnico</option><option value="billing">Facturación</option><option value="admin">Administrador</option></select></label>
      <div className="hidden md:block" />
      <label className="text-sm font-semibold">Contraseña temporal<div className="relative"><input type={showPassword ? "text" : "password"} className={`${inputClass} pr-10`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-3 grid h-8 w-8 place-items-center text-muted-foreground">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <label className="text-sm font-semibold">Confirmar contraseña<input type={showPassword ? "text" : "password"} className={inputClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
    </div>
    <div className="mt-4 flex justify-end"><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}Crear usuario</button></div>
  </form>;
}
