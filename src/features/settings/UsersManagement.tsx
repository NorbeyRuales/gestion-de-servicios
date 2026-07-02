import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Edit3, KeyRound, Loader2, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { CreateUserForm } from "./CreateUserForm";
import { deleteManagedUser } from "./userAdminApi";
import { confirmDestructiveAction, requestDeletionReason } from "../../app/components/ui/destructive-dialog";

type UserRole = "admin" | "technician" | "billing";
interface UserProfile { id: string; full_name: string; email: string; role: UserRole; is_active: boolean; created_at: string }

const roleLabels: Record<UserRole, string> = { admin: "Administrador", technician: "Técnico", billing: "Facturación" };
function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.replace(/^.*?: /, "");
  }
  return "No fue posible completar la operación.";
}

export function UsersManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase.from("profiles").select("id,full_name,email,role,is_active,created_at").order("full_name");
    if (queryError) setError(messageFrom(queryError)); else setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateUser = async (user: UserProfile, changes: Partial<Pick<UserProfile, "role" | "is_active">>) => {
    setBusyId(user.id);
    setError("");
    setSuccess("");
    const { error: updateError } = await supabase.from("profiles").update(changes).eq("id", user.id);
    setBusyId(null);
    if (updateError) return setError(messageFrom(updateError));
    setSuccess("Usuario actualizado correctamente.");
    await load();
  };

  const editName = async (user: UserProfile) => {
    const fullName = window.prompt("Nombre completo:", user.full_name);
    if (fullName === null) return;
    if (fullName.trim().length < 2) return setError("Escribe un nombre válido.");
    setBusyId(user.id); setError(""); setSuccess("");
    const { error: updateError } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    setBusyId(null);
    if (updateError) return setError(messageFrom(updateError));
    setSuccess("Nombre actualizado correctamente.");
    await load();
  };

  const sendPasswordReset = async (user: UserProfile) => {
    if (!await confirmDestructiveAction({ title: "Enviar restablecimiento", description: `Se enviará un enlace para cambiar la contraseña a ${user.email}.`, confirmLabel: "Sí, enviar" })) return;
    setBusyId(user.id); setError(""); setSuccess("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin });
    setBusyId(null);
    if (resetError) return setError(messageFrom(resetError));
    setSuccess(`Enlace de restablecimiento enviado a ${user.email}.`);
  };

  const removeUser = async (user: UserProfile) => {
    if (user.is_active) return setError("Desactiva el usuario antes de eliminarlo.");
    const reason = await requestDeletionReason(user.full_name);
    if (reason === null) return;
    setBusyId(user.id); setError(""); setSuccess("");
    try {
      await deleteManagedUser(user.id, reason);
      setSuccess("Usuario eliminado correctamente.");
      await load();
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setBusyId(null);
    }
  };

  return <div className="space-y-5">
    {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    {success && <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={17} />{success}</div>}
    {creating && <CreateUserForm onCancel={() => setCreating(false)} onCreated={async () => { setCreating(false); setSuccess("Usuario creado correctamente."); await load(); }} />}
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-bold">Usuarios registrados</h2><p className="text-sm text-muted-foreground">Crea cuentas, asigna roles y controla su acceso.</p></div>{!creating && <button onClick={() => { setCreating(true); setError(""); setSuccess(""); }} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><UserPlus size={15} />Nuevo usuario</button>}</div>{loading ? <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div> : <div className="divide-y divide-border">{users.map((user) => {
      const isCurrent = user.id === currentUserId;
      return <article key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><span className={`grid h-10 w-10 place-items-center rounded-full ${user.is_active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{user.role === "admin" ? <ShieldCheck size={18} /> : user.is_active ? <UserCheck size={18} /> : <UserX size={18} />}</span><div className="min-w-52 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-sm">{user.full_name}</h3>{isCurrent && <span className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">Tu cuenta</span>}{!user.is_active && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Inactivo</span>}</div><p className="text-xs text-muted-foreground">{user.email}</p></div><select aria-label={`Rol de ${user.full_name}`} disabled={busyId === user.id} className="rounded-lg border border-border bg-input-background px-3 py-2 text-sm" value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as UserRole })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="flex gap-1"><button type="button" disabled={busyId === user.id} onClick={() => void editName(user)} title="Editar nombre" aria-label={`Editar nombre de ${user.full_name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-50"><Edit3 size={14} /></button><button type="button" disabled={busyId === user.id} onClick={() => void sendPasswordReset(user)} title="Enviar restablecimiento de contraseña" aria-label={`Restablecer contraseña de ${user.full_name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-blue-700 disabled:opacity-50"><KeyRound size={14} /></button></div><button disabled={busyId === user.id || isCurrent} title={isCurrent ? "No puedes desactivar tu sesión actual desde aquí" : undefined} onClick={() => void updateUser(user, { is_active: !user.is_active })} className="min-w-24 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{busyId === user.id ? <Loader2 size={14} className="mx-auto animate-spin" /> : user.is_active ? "Desactivar" : "Reactivar"}</button><button type="button" disabled={busyId === user.id || isCurrent || user.is_active} onClick={() => void removeUser(user)} title={user.is_active ? "Desactívalo antes de eliminar" : "Eliminar usuario sin actividad"} aria-label={`Eliminar ${user.full_name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-600 disabled:opacity-35"><Trash2 size={14} /></button></article>;
    })}</div>}</section>
  </div>;
}
