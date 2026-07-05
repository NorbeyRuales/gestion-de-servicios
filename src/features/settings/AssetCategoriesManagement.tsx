import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Edit3, Layers3, Loader2, Plus, Trash2 } from "lucide-react";
import { confirmDestructiveAction } from "../../app/components/ui/destructive-dialog";
import { supabase } from "../../lib/supabase";

interface AssetCategory { id: string; name: string; is_active: boolean; sort_order: number }
const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    if (error.message.includes("asset_categories_name_unique") || error.message.includes("duplicate key")) return "Ya existe una categoría con ese nombre.";
    return error.message.replace(/^.*?: /, "");
  }
  return "No fue posible completar la operación.";
}

export function AssetCategoriesManagement() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from("asset_categories").select("id,name,is_active,sort_order").order("sort_order").order("name");
    if (queryError) setError(messageFrom(queryError)); else setCategories((data ?? []) as AssetCategory[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const startEdit = (category?: AssetCategory) => {
    const nextOrder = categories.length ? Math.max(...categories.map((item) => item.sort_order)) + 10 : 10;
    setEditing(category ?? { id: "", name: "", is_active: true, sort_order: nextOrder });
    setName(category?.name ?? ""); setSortOrder(category?.sort_order ?? nextOrder); setError(""); setSuccess("");
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || name.trim().length < 2) return setError("Escribe un nombre válido.");
    setSaving(true); setError("");
    const result = editing.id
      ? await supabase.rpc("update_asset_category", { p_id: editing.id, p_name: name.trim(), p_sort_order: sortOrder })
      : await supabase.from("asset_categories").insert({ name: name.trim(), sort_order: sortOrder, is_active: true });
    setSaving(false);
    if (result.error) return setError(messageFrom(result.error));
    setEditing(null); setSuccess(editing.id ? "Categoría actualizada." : "Categoría creada."); await load();
  };
  const toggle = async (category: AssetCategory) => {
    setError(""); setSuccess("");
    const { error: updateError } = await supabase.from("asset_categories").update({ is_active: !category.is_active }).eq("id", category.id);
    if (updateError) return setError(messageFrom(updateError));
    setSuccess(category.is_active ? "Categoría desactivada." : "Categoría reactivada."); await load();
  };
  const remove = async (category: AssetCategory) => {
    if (category.is_active) return setError("Desactiva la categoría antes de eliminarla.");
    if (!await confirmDestructiveAction({ title: "Eliminar categoría", description: `Se eliminará la categoría “${category.name}” si no está asignada a equipos.`, confirmLabel: "Sí, eliminar" })) return;
    setSaving(true); setError(""); setSuccess("");
    const { error: deleteError } = await supabase.rpc("delete_asset_category", { p_id: category.id });
    setSaving(false);
    if (deleteError) return setError(messageFrom(deleteError));
    setSuccess("Categoría eliminada."); await load();
  };

  return <div className="space-y-4">
    {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    {success && <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={17} />{success}</div>}
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Categorías de equipos</h2><p className="text-sm text-muted-foreground">Opciones disponibles al registrar equipos</p></div><button onClick={() => startEdit()} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Nueva categoría</button></div>
    {editing && <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-end gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-4"><label className="min-w-60 flex-1 text-sm font-semibold">Nombre<input autoFocus className={`${inputClass} mt-1.5 w-full`} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="w-28 text-sm font-semibold">Orden<input type="number" min="0" className={`${inputClass} mt-1.5 w-full`} value={sortOrder || ""} onChange={(event) => setSortOrder(Number(event.target.value))} /></label><button type="button" onClick={() => setEditing(null)} className="px-3 py-2.5 text-sm font-semibold text-muted-foreground">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Guardar</button></form>}
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{loading ? <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div> : categories.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">No hay categorías registradas.</p> : <div className="divide-y divide-border">{categories.map((category) => <article key={category.id} className="flex items-center gap-3 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-orange-700"><Layers3 size={16} /></span><div className="flex-1"><h3 className="text-sm font-semibold">{category.name}</h3><p className="text-xs text-muted-foreground">Orden: {category.sort_order}</p></div><span className={`rounded px-2 py-1 text-xs font-semibold ${category.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{category.is_active ? "Activa" : "Inactiva"}</span><button onClick={() => startEdit(category)} aria-label={`Editar ${category.name}`} className="grid h-8 w-8 place-items-center rounded border border-border"><Edit3 size={14} /></button><button onClick={() => void toggle(category)} className="min-w-20 text-xs font-semibold text-[#f97316]">{category.is_active ? "Desactivar" : "Reactivar"}</button><button type="button" disabled={saving} onClick={() => void remove(category)} aria-label={`Eliminar ${category.name}`} className="grid h-8 w-8 place-items-center rounded border border-red-200 text-red-600 disabled:opacity-50"><Trash2 size={14} /></button></article>)}</div>}</section>
  </div>;
}
