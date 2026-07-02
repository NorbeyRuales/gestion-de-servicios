import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { AlertCircle, Camera, CheckCircle2, Cpu, Edit3, History, Layers, Loader2, Package, Plus, Search, Trash2 } from "lucide-react";
import { StyledModal as Modal } from "../../app/components/ui/styled-modal";
import { supabase } from "../../lib/supabase";
import { requestControlledDeletion } from "../../lib/adminDeletion";
import { TechnicalHistory } from "../work-orders/TechnicalHistory";
import { AssetPhotos } from "./AssetPhotos";

interface AreaRecord {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

type AssetStatus = "operational" | "needs_review" | "under_repair" | "out_of_service" | "retired";

interface AssetRecord {
  id: string;
  branch_id: string;
  area_id: string | null;
  internal_code: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: AssetStatus;
  purchase_date: string | null;
  last_maintenance_date: string | null;
  notes: string | null;
  is_active: boolean;
  areas?: { id: string; name: string } | null;
}

const areaSchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre válido."),
  description: z.string().trim(),
});

const assetSchema = z.object({
  internal_code: z.string().trim().refine((value) => value.length === 0 || value.length >= 2, "El código manual debe tener al menos 2 caracteres."),
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  category: z.string().trim().min(2, "La categoría es obligatoria."),
  area_id: z.string(),
  brand: z.string().trim(),
  model: z.string().trim(),
  serial_number: z.string().trim(),
  status: z.enum(["operational", "needs_review", "under_repair", "out_of_service", "retired"]),
  purchase_date: z.string(),
  last_maintenance_date: z.string(),
  notes: z.string().trim(),
});

type AreaValue = z.infer<typeof areaSchema>;
type AssetValue = z.infer<typeof assetSchema>;

const statusLabels: Record<AssetStatus, string> = {
  operational: "Operativo",
  needs_review: "Requiere revisión",
  under_repair: "En reparación",
  out_of_service: "Fuera de servicio",
  retired: "Retirado",
};

const statusStyles: Record<AssetStatus, string> = {
  operational: "bg-green-50 text-green-700",
  needs_review: "bg-amber-50 text-amber-700",
  under_repair: "bg-blue-50 text-blue-700",
  out_of_service: "bg-red-50 text-red-700",
  retired: "bg-slate-100 text-slate-600",
};

const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (!error) return "No fue posible completar la operación.";
  const message = error instanceof Error
    ? error.message
    : typeof error === "object"
      ? "message" in error && typeof error.message === "string"
        ? error.message
        : "details" in error && typeof error.details === "string"
          ? error.details
          : "hint" in error && typeof error.hint === "string"
            ? error.hint
            : JSON.stringify(error)
      : String(error);
  if (message.includes("areas_branch_id_name_key")) return "Ya existe un área con ese nombre en esta sede.";
  if (message.includes("assets_internal_code_key")) return "Ese código interno ya está asignado a otro equipo.";
  return message || "No fue posible completar la operación.";
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null;
  return <div role={error ? "alert" : undefined} className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>{error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{error || success}</div>;
}

function AreaForm({ initial, saving, onCancel, onSave }: { initial?: AreaRecord; saving: boolean; onCancel: () => void; onSave: (value: AreaValue) => Promise<void> }) {
  const [value, setValue] = useState<AreaValue>({ name: initial?.name ?? "", description: initial?.description ?? "" });
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = areaSchema.safeParse(value);
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Revisa los campos.");
    try { setError(""); await onSave(result.data); } catch (caught) { setError(messageFrom(caught)); }
  };
  return <form onSubmit={submit} className="p-5 space-y-4">{error && <Feedback error={error} success="" />}<label className="block text-sm font-semibold">Nombre del área *<input autoFocus required className={inputClass} value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Ej. Cocina" /></label><label className="block text-sm font-semibold">Descripción<textarea rows={3} className={inputClass} value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">Cancelar</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-[#f97316] text-white flex items-center gap-2 disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}Guardar área</button></div></form>;
}

function AssetForm({ areas, initial, saving, onCancel, onSave }: { areas: AreaRecord[]; initial?: AssetRecord; saving: boolean; onCancel: () => void; onSave: (value: AssetValue) => Promise<void> }) {
  const [value, setValue] = useState<AssetValue>({
    internal_code: initial?.internal_code ?? "", name: initial?.name ?? "", category: initial?.category ?? "",
    area_id: initial?.area_id ?? "", brand: initial?.brand ?? "", model: initial?.model ?? "",
    serial_number: initial?.serial_number ?? "", status: initial?.status ?? "operational",
    purchase_date: initial?.purchase_date ?? "", last_maintenance_date: initial?.last_maintenance_date ?? "", notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");
  const set = (key: keyof AssetValue, next: string) => setValue((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = assetSchema.safeParse(value);
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Revisa los campos.");
    try { setError(""); await onSave(result.data); } catch (caught) { setError(messageFrom(caught)); }
  };
  return <form onSubmit={submit} className="p-5 space-y-4">{error && <Feedback error={error} success="" />}<div className="grid sm:grid-cols-2 gap-4">
    <label className="text-sm font-semibold">Código interno {initial ? "*" : "(opcional)"}<input required={Boolean(initial)} className={inputClass} value={value.internal_code} onChange={(event) => set("internal_code", event.target.value.toUpperCase())} placeholder={initial ? "Código del equipo" : "Se genera al guardar"} /><span className="mt-1 block text-xs font-normal text-muted-foreground">{initial ? "Puedes conservarlo o cambiarlo manualmente." : "Déjalo vacío para usar las primeras letras de la categoría y el siguiente consecutivo."}</span></label>
    <label className="text-sm font-semibold">Nombre *<input autoFocus required className={inputClass} value={value.name} onChange={(event) => set("name", event.target.value)} /></label>
    <label className="text-sm font-semibold">Categoría *<input required className={inputClass} value={value.category} onChange={(event) => set("category", event.target.value)} placeholder="Freidora industrial" /></label>
    <label className="text-sm font-semibold">Área<select className={inputClass} value={value.area_id} onChange={(event) => set("area_id", event.target.value)}><option value="">Sin área específica</option>{areas.filter((area) => area.is_active || area.id === initial?.area_id).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
    <label className="text-sm font-semibold">Marca<input className={inputClass} value={value.brand} onChange={(event) => set("brand", event.target.value)} /></label>
    <label className="text-sm font-semibold">Modelo<input className={inputClass} value={value.model} onChange={(event) => set("model", event.target.value)} /></label>
    <label className="text-sm font-semibold">Número de serie<input className={inputClass} value={value.serial_number} onChange={(event) => set("serial_number", event.target.value)} /></label>
    <label className="text-sm font-semibold">Estado<select className={inputClass} value={value.status} onChange={(event) => set("status", event.target.value)}>{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold">Fecha de compra<input type="date" className={inputClass} value={value.purchase_date} onChange={(event) => set("purchase_date", event.target.value)} /></label>
    <label className="text-sm font-semibold">Último mantenimiento<input type="date" className={inputClass} value={value.last_maintenance_date} onChange={(event) => set("last_maintenance_date", event.target.value)} /></label>
    <label className="sm:col-span-2 text-sm font-semibold">Notas<textarea rows={3} className={inputClass} value={value.notes} onChange={(event) => set("notes", event.target.value)} /></label>
  </div><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">Cancelar</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-[#f97316] text-white flex items-center gap-2 disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}Guardar equipo</button></div></form>;
}

export function AssetManagement({ branchId, canAdminister = false, onNewWorkOrder, onOpenOrder }: { branchId: string; canAdminister?: boolean; onNewWorkOrder: (assetId: string) => void; onOpenOrder: (orderId: string) => void }) {
  const [tab, setTab] = useState<"assets" | "areas">("assets");
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaRecord | "new" | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | "new" | null>(null);
  const [photoAsset, setPhotoAsset] = useState<AssetRecord | null>(null);
  const [historyAsset, setHistoryAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [areasResult, assetsResult] = await Promise.all([
      supabase.from("areas").select("id,branch_id,name,description,is_active").eq("branch_id", branchId).order("name"),
      supabase.from("assets").select("id,branch_id,area_id,internal_code,name,category,brand,model,serial_number,status,purchase_date,last_maintenance_date,notes,is_active,areas(id,name)").eq("branch_id", branchId).order("name"),
    ]);
    if (areasResult.error) setError(messageFrom(areasResult.error)); else setAreas((areasResult.data ?? []) as AreaRecord[]);
    if (assetsResult.error) setError(messageFrom(assetsResult.error)); else setAssets((assetsResult.data ?? []) as unknown as AssetRecord[]);
    setLoading(false);
  }, [branchId]);
  useEffect(() => { void load(); }, [load]);

  const filteredAssets = useMemo(() => assets.filter((asset) => [asset.name, asset.internal_code, asset.category, asset.brand, asset.model].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [assets, search]);

  const saveArea = async (value: AreaValue) => {
    setSaving(true);
    try {
      const payload = { name: value.name.trim(), description: value.description.trim() || null };
      const result = editingArea === "new" ? await supabase.from("areas").insert({ ...payload, branch_id: branchId, is_active: true }) : await supabase.from("areas").update(payload).eq("id", editingArea!.id);
      if (result.error) throw result.error;
      setEditingArea(null); setSuccess(editingArea === "new" ? "Área creada correctamente." : "Área actualizada."); await load();
    } finally {
      setSaving(false);
    }
  };

  const saveAsset = async (value: AssetValue) => {
    setSaving(true);
    try {
      const payload = { internal_code: value.internal_code.trim().toUpperCase(), name: value.name.trim(), category: value.category.trim(), area_id: value.area_id || null, brand: value.brand.trim() || null, model: value.model.trim() || null, serial_number: value.serial_number.trim() || null, status: value.status, purchase_date: value.purchase_date || null, last_maintenance_date: value.last_maintenance_date || null, notes: value.notes.trim() || null };
      const isNew = editingAsset === "new";
      const result = isNew
        ? await supabase.from("assets").insert({ ...payload, branch_id: branchId, is_active: true }).select("internal_code").single()
        : await supabase.from("assets").update(payload).eq("id", editingAsset!.id).select("internal_code").single();
      if (result.error) throw result.error;
      setEditingAsset(null); setSuccess(isNew ? `Equipo creado con código ${result.data.internal_code}.` : "Equipo actualizado."); await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = async (area: AreaRecord) => { const { error: updateError } = await supabase.from("areas").update({ is_active: !area.is_active }).eq("id", area.id); if (updateError) return setError(messageFrom(updateError)); setSuccess(area.is_active ? "Área desactivada." : "Área reactivada."); await load(); };
  const toggleAsset = async (asset: AssetRecord) => { const { error: updateError } = await supabase.from("assets").update({ is_active: !asset.is_active }).eq("id", asset.id); if (updateError) return setError(messageFrom(updateError)); setSuccess(asset.is_active ? "Equipo desactivado." : "Equipo reactivado."); await load(); };
  const removeArea = async (area: AreaRecord) => { setSaving(true); setError(""); setSuccess(""); try { if (area.is_active) throw new Error("Desactiva el área antes de eliminarla."); if (await requestControlledDeletion("area", area.id, area.name)) { setSuccess("Área eliminada."); await load(); } } catch (deleteError) { setError(messageFrom(deleteError)); } finally { setSaving(false); } };
  const removeAsset = async (asset: AssetRecord) => { setSaving(true); setError(""); setSuccess(""); try { if (asset.is_active) throw new Error("Desactiva el equipo antes de eliminarlo."); if (await requestControlledDeletion("asset", asset.id, `${asset.internal_code} - ${asset.name}`)) { setSuccess("Equipo eliminado."); await load(); } } catch (deleteError) { setError(messageFrom(deleteError)); } finally { setSaving(false); } };

  return <section className="mt-6">
    <Feedback error={error} success={success} />
    <div className="flex items-center justify-between gap-3 border-b border-border mb-4"><div role="tablist" aria-label="Equipos y áreas" className="flex gap-1"><button role="tab" aria-selected={tab === "assets"} onClick={() => setTab("assets")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 ${tab === "assets" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-muted-foreground"}`}><Cpu size={16} />Equipos ({assets.length})</button><button role="tab" aria-selected={tab === "areas"} onClick={() => setTab("areas")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 ${tab === "areas" ? "border-[#f97316] text-[#f97316]" : "border-transparent text-muted-foreground"}`}><Layers size={16} />Áreas ({areas.length})</button></div><button onClick={() => tab === "assets" ? setEditingAsset("new") : setEditingArea("new")} className="mb-2 flex items-center gap-1 bg-[#f97316] text-white rounded-lg px-3 py-2 text-sm font-semibold"><Plus size={15} /><span className="hidden sm:inline">{tab === "assets" ? "Nuevo equipo" : "Nueva área"}</span></button></div>
    {loading ? <div className="py-12 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : tab === "assets" ? <>
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#f97316]" placeholder="Buscar por nombre, código, categoría, marca o modelo…" /></div>
      {filteredAssets.length === 0 ? <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center"><Package className="mx-auto text-muted-foreground" /><h3 className="mt-3 font-semibold">{assets.length ? "No hay coincidencias" : "No hay equipos registrados"}</h3>{!assets.length && <button onClick={() => setEditingAsset("new")} className="mt-4 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold">Registrar primer equipo</button>}</div> : <div className="space-y-2">{filteredAssets.map((asset) => <article key={asset.id} className="bg-card rounded-xl border border-border p-4 shadow-sm"><div className="flex items-start gap-3"><div className="h-10 w-10 rounded-lg bg-muted grid place-items-center text-[#1a3558]"><Package size={18} /></div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-sm">{asset.name}</h3><p className="font-mono text-xs text-muted-foreground">{asset.internal_code}</p></div><span className={`text-xs px-2 py-1 rounded ${statusStyles[asset.status]}`}>{statusLabels[asset.status]}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{asset.category}</span><span>{[asset.brand, asset.model].filter(Boolean).join(" ") || "Sin marca/modelo"}</span><span>{asset.areas?.name || "Sin área"}</span>{asset.last_maintenance_date && <span>Último servicio: {new Date(`${asset.last_maintenance_date}T00:00:00`).toLocaleDateString("es-CO")}</span>}{!asset.is_active && <span className="font-semibold text-red-600">Inactivo</span>}</div></div></div><div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2"><button onClick={() => setEditingAsset(asset)} className="text-xs font-semibold px-3 py-1.5 rounded bg-muted text-[#1a3558] flex items-center gap-1"><Edit3 size={13} />Editar</button><button onClick={() => setPhotoAsset(asset)} className="text-xs font-semibold px-3 py-1.5 rounded bg-muted text-[#1a3558] flex items-center gap-1"><Camera size={13} />Fotos</button><button onClick={() => setHistoryAsset(asset)} className="text-xs font-semibold px-3 py-1.5 rounded bg-muted text-[#1a3558] flex items-center gap-1"><History size={13} />Historial</button><button onClick={() => void toggleAsset(asset)} className="text-xs font-semibold text-[#f97316] px-2">{asset.is_active ? "Desactivar" : "Reactivar"}</button>{canAdminister && <button type="button" disabled={saving} onClick={() => void removeAsset(asset)} title="Solo se elimina si no tiene órdenes ni fotos" className="ml-auto flex items-center gap-1 px-2 text-xs font-semibold text-red-600 disabled:opacity-50"><Trash2 size={13} />Eliminar</button>}</div></article>)}</div>}
    </> : areas.length === 0 ? <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center"><Layers className="mx-auto text-muted-foreground" /><h3 className="mt-3 font-semibold">No hay áreas registradas</h3><p className="mt-1 text-sm text-muted-foreground">También puedes registrar equipos sin asignar un área.</p><button onClick={() => setEditingArea("new")} className="mt-4 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold">Crear primera área</button></div> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{areas.map((area) => { const count = assets.filter((asset) => asset.area_id === area.id).length; return <article key={area.id} className="bg-card rounded-xl border border-border p-4 shadow-sm"><div className="flex justify-between"><div className="h-9 w-9 bg-muted text-[#1a3558] rounded-lg grid place-items-center"><Layers size={17} /></div><span className={`text-xs px-2 py-1 rounded ${area.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{area.is_active ? "Activa" : "Inactiva"}</span></div><h3 className="font-semibold mt-3">{area.name}</h3><p className="text-xs text-muted-foreground mt-1 min-h-8">{area.description || "Sin descripción"}</p><p className="mt-3 text-xs font-semibold">{count} equipo{count === 1 ? "" : "s"}</p><div className="mt-3 pt-3 border-t border-border flex gap-2"><button onClick={() => setEditingArea(area)} className="text-xs font-semibold px-3 py-1.5 rounded bg-muted text-[#1a3558] flex items-center gap-1"><Edit3 size={13} />Editar</button><button onClick={() => void toggleArea(area)} className="text-xs font-semibold text-[#f97316] px-2">{area.is_active ? "Desactivar" : "Reactivar"}</button>{canAdminister && <button type="button" disabled={saving} onClick={() => void removeArea(area)} title="Solo se elimina si no tiene equipos ni órdenes" className="ml-auto grid h-7 w-7 place-items-center text-red-600 disabled:opacity-50" aria-label={`Eliminar ${area.name}`}><Trash2 size={13} /></button>}</div></article>; })}</div>}
    {editingArea && <Modal title={editingArea === "new" ? "Nueva área" : "Editar área"} onClose={() => setEditingArea(null)}><AreaForm initial={editingArea === "new" ? undefined : editingArea} saving={saving} onCancel={() => setEditingArea(null)} onSave={saveArea} /></Modal>}
    {editingAsset && <Modal title={editingAsset === "new" ? "Nuevo equipo" : "Editar equipo"} onClose={() => setEditingAsset(null)}><AssetForm areas={areas} initial={editingAsset === "new" ? undefined : editingAsset} saving={saving} onCancel={() => setEditingAsset(null)} onSave={saveAsset} /></Modal>}
    {photoAsset && <Modal title={`Fotos · ${photoAsset.name}`} onClose={() => setPhotoAsset(null)}><AssetPhotos assetId={photoAsset.id} assetName={photoAsset.name} disabled={!photoAsset.is_active} /></Modal>}
    {historyAsset && <Modal title={`Historial · ${historyAsset.name}`} onClose={() => setHistoryAsset(null)}><div className="p-5"><TechnicalHistory branchId={branchId} assetId={historyAsset.id} assetName={historyAsset.name} onNewWorkOrder={(assetId) => { setHistoryAsset(null); onNewWorkOrder(assetId ?? historyAsset.id); }} onOpenOrder={(orderId) => { setHistoryAsset(null); onOpenOrder(orderId); }} /></div></Modal>}
  </section>;
}
