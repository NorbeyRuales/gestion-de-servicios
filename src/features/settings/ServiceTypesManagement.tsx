import { useCallback, useEffect, useState } from "react";
import { Edit3, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { requestControlledDeletion } from "../../lib/adminDeletion";
import { ToastFeedback } from "../../components/ToastFeedback";

interface ServiceType { id: string; name: string; is_active: boolean; sort_order: number }
const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    if (error.message.includes("duplicate key")) return "Ya existe un tipo de servicio con ese nombre.";
    return error.message;
  }
  return "No fue posible completar la operación.";
}

export function ServiceTypesManagement() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("service_types").select("id,name,is_active,sort_order").order("sort_order").order("name");
    if (queryError) setError(messageFrom(queryError)); else setTypes((data ?? []) as ServiceType[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const startEdit = (type?: ServiceType) => { setEditing(type ?? { id: "", name: "", is_active: true, sort_order: types.length ? Math.max(...types.map((item) => item.sort_order)) + 10 : 10 }); setName(type?.name ?? ""); setError(""); setSuccess(""); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || name.trim().length < 2) return setError("Escribe un nombre válido.");
    setSaving(true);
    const result = editing.id
      ? await supabase.from("service_types").update({ name: name.trim() }).eq("id", editing.id)
      : await supabase.from("service_types").insert({ name: name.trim(), sort_order: editing.sort_order, is_active: true });
    setSaving(false);
    if (result.error) return setError(messageFrom(result.error));
    setEditing(null);
    setSuccess(editing.id ? "Tipo de servicio actualizado." : "Tipo de servicio creado.");
    await load();
  };
  const toggle = async (type: ServiceType) => {
    setError(""); setSuccess("");
    const { error: updateError } = await supabase.from("service_types").update({ is_active: !type.is_active }).eq("id", type.id);
    if (updateError) return setError(messageFrom(updateError));
    setSuccess(type.is_active ? "Tipo de servicio desactivado." : "Tipo de servicio reactivado.");
    await load();
  };
  const remove = async (type: ServiceType) => {
    setError(""); setSuccess(""); setSaving(true);
    try {
      if (type.is_active) throw new Error("Desactiva el tipo de servicio antes de eliminarlo.");
      if (await requestControlledDeletion("service_type", type.id, type.name)) {
        setSuccess("Tipo de servicio eliminado.");
        await load();
      }
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <ToastFeedback error={error} success={success} />
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Tipos de servicio</h2><p className="text-sm text-muted-foreground">Catálogo disponible al crear órdenes de trabajo</p></div><button onClick={() => startEdit()} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Nuevo tipo</button></div>
    {editing && <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-end gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-4"><label className="min-w-60 flex-1 text-sm font-semibold">Nombre<input autoFocus className={`${inputClass} mt-1.5 w-full`} value={name} onChange={(event) => setName(event.target.value)} /></label><button type="button" onClick={() => setEditing(null)} className="px-3 py-2.5 text-sm font-semibold text-muted-foreground">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Guardar</button></form>}
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{loading ? <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div> : <div className="divide-y divide-border">{types.map((type) => <article key={type.id} className="flex items-center gap-3 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#1a3558]"><Wrench size={16} /></span><div className="flex-1"><h3 className="text-sm font-semibold">{type.name}</h3><p className="text-xs text-muted-foreground">Orden: {type.sort_order}</p></div><span className={`rounded px-2 py-1 text-xs font-semibold ${type.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{type.is_active ? "Activo" : "Inactivo"}</span><button onClick={() => startEdit(type)} aria-label={`Editar ${type.name}`} className="grid h-8 w-8 place-items-center rounded border border-border"><Edit3 size={14} /></button><button onClick={() => void toggle(type)} className="min-w-20 text-xs font-semibold text-[#f97316]">{type.is_active ? "Desactivar" : "Reactivar"}</button><button type="button" disabled={saving} onClick={() => void remove(type)} aria-label={`Eliminar ${type.name}`} title="Solo se elimina si nunca fue usado" className="grid h-8 w-8 place-items-center rounded border border-red-200 text-red-600 disabled:opacity-50"><Trash2 size={14} /></button></article>)}</div>}</section>
  </div>;
}
