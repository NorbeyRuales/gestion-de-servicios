import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Edit3, Loader2, Plus, UserRoundCog } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Technician {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  company: string | null;
  profile_id: string | null;
  is_active: boolean;
}

const emptyForm = { name: "", phone: "", email: "", specialty: "", company: "" };
const inputClass = "w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible completar la operación.";
}

export function TechniciansManagement() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [editing, setEditing] = useState<Technician | null | "new">(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("technicians").select("id,name,phone,email,specialty,company,profile_id,is_active").order("name");
    if (queryError) setError(errorMessage(queryError)); else setTechnicians((data ?? []) as Technician[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openForm = (technician?: Technician) => {
    setEditing(technician ?? "new");
    setForm(technician ? { name: technician.name, phone: technician.phone ?? "", email: technician.email ?? "", specialty: technician.specialty ?? "", company: technician.company ?? "" } : emptyForm);
    setError(""); setSuccess("");
  };
  const setField = (field: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("El nombre del técnico es obligatorio.");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError("El correo no es válido.");
    setSaving(true); setError(""); setSuccess("");
    const values = { name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, specialty: form.specialty.trim() || null, company: form.company.trim() || null };
    const result = editing !== "new" && editing ? await supabase.from("technicians").update(values).eq("id", editing.id) : await supabase.from("technicians").insert(values);
    setSaving(false);
    if (result.error) return setError(errorMessage(result.error));
    setEditing(null); setSuccess(editing === "new" ? "Técnico creado." : "Técnico actualizado.");
    await load();
  };
  const toggle = async (technician: Technician) => {
    setError(""); setSuccess("");
    const { error: updateError } = await supabase.from("technicians").update({ is_active: !technician.is_active }).eq("id", technician.id);
    if (updateError) return setError(errorMessage(updateError));
    setSuccess(technician.is_active ? "Técnico desactivado." : "Técnico reactivado.");
    await load();
  };

  return <div className="space-y-4">
    {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    {success && <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={17} />{success}</div>}
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Técnicos</h2><p className="text-sm text-muted-foreground">Personal interno o externo disponible para asignar a las órdenes</p></div><button onClick={() => openForm()} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Nuevo técnico</button></div>
    {editing && <form onSubmit={(event) => void save(event)} className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:grid-cols-2"><label className="text-sm font-semibold">Nombre *<input autoFocus required className={`${inputClass} mt-1.5`} value={form.name} onChange={(event) => setField("name", event.target.value)} /></label><label className="text-sm font-semibold">Teléfono <span className="font-normal text-muted-foreground">(opcional)</span><input className={`${inputClass} mt-1.5`} value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label><label className="text-sm font-semibold">Correo <span className="font-normal text-muted-foreground">(opcional)</span><input type="email" className={`${inputClass} mt-1.5`} value={form.email} onChange={(event) => setField("email", event.target.value)} /></label><label className="text-sm font-semibold">Especialidad <span className="font-normal text-muted-foreground">(opcional)</span><input className={`${inputClass} mt-1.5`} value={form.specialty} onChange={(event) => setField("specialty", event.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Empresa o proveedor <span className="font-normal text-muted-foreground">(opcional)</span><input className={`${inputClass} mt-1.5`} value={form.company} onChange={(event) => setField("company", event.target.value)} /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold text-muted-foreground">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Guardar</button></div></form>}
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{loading ? <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div> : technicians.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">No hay técnicos registrados.</p> : <div className="divide-y divide-border">{technicians.map((technician) => <article key={technician.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#1a3558]"><UserRoundCog size={17} /></span><div className="min-w-48 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{technician.name}</h3>{technician.profile_id && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Con acceso</span>}</div><p className="text-xs text-muted-foreground">{[technician.specialty, technician.company, technician.phone, technician.email].filter(Boolean).join(" · ") || "Sin datos adicionales"}</p></div><span className={`rounded px-2 py-1 text-xs font-semibold ${technician.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{technician.is_active ? "Activo" : "Inactivo"}</span><button onClick={() => openForm(technician)} aria-label={`Editar ${technician.name}`} className="grid h-8 w-8 place-items-center rounded border border-border"><Edit3 size={14} /></button><button onClick={() => void toggle(technician)} className="min-w-20 text-xs font-semibold text-[#f97316]">{technician.is_active ? "Desactivar" : "Reactivar"}</button></article>)}</div>}</section>
  </div>;
}
