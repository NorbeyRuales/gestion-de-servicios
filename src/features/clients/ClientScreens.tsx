import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  AlertCircle, ArrowLeft, Building2, ChevronRight, Edit3,
  Loader2, Mail, MapPin, Phone, Plus, Search, Trash2, User,
} from "lucide-react";
import { StyledModal as Modal } from "../../app/components/ui/styled-modal";
import { supabase } from "../../lib/supabase";
import { ToastFeedback } from "../../components/ToastFeedback";
import { QUERY_LIMITS } from "../../lib/queryLimits";
import { requestControlledDeletion } from "../../lib/adminDeletion";
import { AssetManagement } from "../assets/AssetManagement";
import { TechnicalHistory } from "../work-orders/TechnicalHistory";

export type ClientNavigationScreen = "client-detail" | "location-detail" | "new-work-order";

interface ClientRecord {
  id: string;
  name: string;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  main_contact_name: string | null;
  main_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  branches?: { id: string }[];
  work_orders?: { id: string; status: string }[];
  invoices?: { grand_total: number; status: string; payments?: { amount: number }[] }[];
}

interface BranchRecord {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  notes: string | null;
  is_active: boolean;
  clients?: { id: string; name: string } | null;
  areas?: { id: string }[];
  assets?: { id: string }[];
  work_orders?: { id: string; status: string }[];
}

const clientSchema = z.object({
  name: z.string().trim().min(2, "Escribe un nombre válido."),
  document_type: z.string().trim(),
  document_number: z.string().trim(),
  phone: z.string().trim(),
  email: z.union([z.literal(""), z.string().trim().email("El correo no es válido.")]),
  billing_address: z.string().trim(),
  main_contact_name: z.string().trim(),
  main_contact_phone: z.string().trim(),
  notes: z.string().trim(),
});

const branchSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la sede."),
  address: z.string().trim(),
  manager_name: z.string().trim(),
  manager_phone: z.string().trim(),
  notes: z.string().trim(),
});

type ClientFormValue = z.infer<typeof clientSchema>;
type BranchFormValue = z.infer<typeof branchSchema>;

const emptyClient: ClientFormValue = {
  name: "", document_type: "NIT", document_number: "", phone: "", email: "",
  billing_address: "", main_contact_name: "", main_contact_phone: "", notes: "",
};

const emptyBranch: BranchFormValue = {
  name: "", address: "", manager_name: "", manager_phone: "", notes: "",
};

const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function cleanPayload<T extends Record<string, string>>(values: T) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() || null]));
}

function errorMessage(error: unknown) {
  if (!error) return "Ocurrió un error inesperado.";
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
  if (message.includes("clients_document_unique")) return "Ya existe un cliente con ese tipo y número de documento.";
  if (message.includes("branches_client_id_name_key")) return "Ya existe una sede con ese nombre para este cliente.";
  return message || "Ocurrió un error inesperado.";
}

function PageTitle({ title, subtitle, back, onBack, action }: { title: string; subtitle?: string; back?: boolean; onBack?: () => void; action?: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 mb-5">
    <div className="flex items-start gap-2 min-w-0">
      {back && <button onClick={onBack} className="mt-0.5 h-8 w-8 grid place-items-center rounded-md hover:bg-muted" aria-label="Volver"><ArrowLeft size={18} /></button>}
      <div className="min-w-0"><h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}</div>
    </div>
    {action}
  </div>;
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  return <ToastFeedback error={error} success={success} />;
}

function LoadingState() {
  return <div className="py-20 grid place-items-center text-muted-foreground"><div className="flex items-center gap-2"><Loader2 size={20} className="animate-spin" />Cargando información…</div></div>;
}

function ClientForm({ initial, saving, onCancel, onSave }: { initial?: ClientRecord; saving: boolean; onCancel: () => void; onSave: (value: ClientFormValue) => Promise<void> }) {
  const [value, setValue] = useState<ClientFormValue>(initial ? {
    name: initial.name, document_type: initial.document_type ?? "NIT", document_number: initial.document_number ?? "",
    phone: initial.phone ?? "", email: initial.email ?? "", billing_address: initial.billing_address ?? "",
    main_contact_name: initial.main_contact_name ?? "", main_contact_phone: initial.main_contact_phone ?? "", notes: initial.notes ?? "",
  } : emptyClient);
  const [error, setError] = useState("");
  const set = (key: keyof ClientFormValue, next: string) => setValue((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = clientSchema.safeParse(value);
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Revisa los campos.");
    setError("");
    try {
      await onSave(result.data);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  return <form onSubmit={submit} className="p-5 space-y-4">
    <Feedback error={error} />
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="sm:col-span-2 text-sm font-semibold">Nombre o razón social *<input autoFocus className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} required /></label>
      <label className="text-sm font-semibold">Tipo de documento<select className={inputClass} value={value.document_type} onChange={(e) => set("document_type", e.target.value)}><option>NIT</option><option>CC</option><option>CE</option><option>Pasaporte</option><option>Otro</option></select></label>
      <label className="text-sm font-semibold">Número de documento<input className={inputClass} value={value.document_number} onChange={(e) => set("document_number", e.target.value)} /></label>
      <label className="text-sm font-semibold">Teléfono<input className={inputClass} value={value.phone} onChange={(e) => set("phone", e.target.value)} /></label>
      <label className="text-sm font-semibold">Correo<input type="email" className={inputClass} value={value.email} onChange={(e) => set("email", e.target.value)} /></label>
      <label className="sm:col-span-2 text-sm font-semibold">Dirección de facturación<input className={inputClass} value={value.billing_address} onChange={(e) => set("billing_address", e.target.value)} /></label>
      <label className="text-sm font-semibold">Contacto principal<input className={inputClass} value={value.main_contact_name} onChange={(e) => set("main_contact_name", e.target.value)} /></label>
      <label className="text-sm font-semibold">Teléfono del contacto<input className={inputClass} value={value.main_contact_phone} onChange={(e) => set("main_contact_phone", e.target.value)} /></label>
      <label className="sm:col-span-2 text-sm font-semibold">Notas<textarea rows={3} className={inputClass} value={value.notes} onChange={(e) => set("notes", e.target.value)} /></label>
    </div>
    <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">Cancelar</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-[#f97316] text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}Guardar cliente</button></div>
  </form>;
}

function BranchForm({ initial, saving, onCancel, onSave }: { initial?: BranchRecord; saving: boolean; onCancel: () => void; onSave: (value: BranchFormValue) => Promise<void> }) {
  const [value, setValue] = useState<BranchFormValue>(initial ? { name: initial.name, address: initial.address ?? "", manager_name: initial.manager_name ?? "", manager_phone: initial.manager_phone ?? "", notes: initial.notes ?? "" } : emptyBranch);
  const [error, setError] = useState("");
  const set = (key: keyof BranchFormValue, next: string) => setValue((current) => ({ ...current, [key]: next }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = branchSchema.safeParse(value);
    if (!result.success) return setError(result.error.issues[0]?.message ?? "Revisa los campos.");
    setError("");
    try {
      await onSave(result.data);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  return <form onSubmit={submit} className="p-5 space-y-4"><Feedback error={error} /><div className="grid sm:grid-cols-2 gap-4">
    <label className="sm:col-span-2 text-sm font-semibold">Nombre de la sede *<input autoFocus className={inputClass} value={value.name} onChange={(e) => set("name", e.target.value)} required placeholder="Ej. Sede Centro" /></label>
    <label className="sm:col-span-2 text-sm font-semibold">Dirección<input className={inputClass} value={value.address} onChange={(e) => set("address", e.target.value)} /></label>
    <label className="text-sm font-semibold">Encargado<input className={inputClass} value={value.manager_name} onChange={(e) => set("manager_name", e.target.value)} /></label>
    <label className="text-sm font-semibold">Teléfono<input className={inputClass} value={value.manager_phone} onChange={(e) => set("manager_phone", e.target.value)} /></label>
    <label className="sm:col-span-2 text-sm font-semibold">Notas<textarea rows={3} className={inputClass} value={value.notes} onChange={(e) => set("notes", e.target.value)} /></label>
  </div><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">Cancelar</button><button disabled={saving} className="px-4 py-2 rounded-lg bg-[#f97316] text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}Guardar sede</button></div></form>;
}

export function ClientsScreen({ onNav, onSelectClient }: { onNav: (screen: ClientNavigationScreen) => void; onSelectClient: (id: string) => void }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("clients").select("id,name,document_type,document_number,phone,email,billing_address,main_contact_name,main_contact_phone,notes,is_active,branches(id),work_orders(id,status),invoices(grand_total,status,payments(amount))").order("name").limit(QUERY_LIMITS.list);
    if (queryError) setError(errorMessage(queryError)); else setClients((data ?? []) as ClientRecord[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => clients.filter((client) => [client.name, client.document_number, client.phone].some((value) => value?.toLowerCase().includes(search.toLowerCase()))), [clients, search]);
  const save = async (value: ClientFormValue) => {
    setSaving(true); setError("");
    const { error: insertError } = await supabase.from("clients").insert({ ...cleanPayload(value), name: value.name.trim(), is_active: true });
    setSaving(false);
    if (insertError) throw insertError;
    setShowForm(false); setSuccess("Cliente creado correctamente."); await load();
  };

  return <div>
    <PageTitle title="Clientes" subtitle={`${clients.length} cliente${clients.length === 1 ? "" : "s"} registrado${clients.length === 1 ? "" : "s"}`} action={<button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#f97316] hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus size={16} /><span className="hidden sm:inline">Nuevo cliente</span></button>} />
    <Feedback error={error} success={success} />
    <div className="relative mb-4"><Search size={17} className="absolute left-3 top-3 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#f97316]" placeholder="Buscar por nombre, documento o teléfono…" /></div>
    {loading ? <LoadingState /> : filtered.length === 0 ? <div className="bg-card border border-dashed border-border rounded-2xl py-16 px-5 text-center"><div className="mx-auto h-12 w-12 rounded-xl bg-muted grid place-items-center text-[#1a3558]"><Building2 /></div><h2 className="mt-4 font-bold">{clients.length ? "No encontramos coincidencias" : "Aún no hay clientes"}</h2><p className="mt-1 text-sm text-muted-foreground">{clients.length ? "Prueba otra búsqueda." : "Crea el primer cliente para comenzar a organizar sus sedes."}</p>{!clients.length && <button onClick={() => setShowForm(true)} className="mt-5 bg-[#f97316] text-white px-4 py-2 rounded-lg font-semibold">Crear primer cliente</button>}</div> : <div className="space-y-3">{filtered.map((client) => {
      const pending = client.work_orders?.filter((order) => !["completed", "cancelled", "invoiced"].includes(order.status)).length ?? 0;
      const balance = client.invoices?.filter((invoice) => !["paid", "void"].includes(invoice.status)).reduce((total, invoice) => total + Math.max(Number(invoice.grand_total) - (invoice.payments?.reduce((paid, payment) => paid + Number(payment.amount), 0) ?? 0), 0), 0) ?? 0;
      return <button key={client.id} onClick={() => { onSelectClient(client.id); onNav("client-detail"); }} className="w-full text-left bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:border-orange-200 transition-all">
        <div className="flex gap-3"><div className="h-10 w-10 shrink-0 rounded-lg bg-[#1a3558] text-white grid place-items-center font-bold text-sm">{client.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><h3 className="font-semibold text-sm truncate">{client.name}</h3><p className="text-xs text-muted-foreground font-mono">{[client.document_type, client.document_number].filter(Boolean).join(" ") || "Sin documento"}</p></div><div className="flex items-center gap-2">{!client.is_active && <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Inactivo</span>}<ChevronRight size={17} className="text-muted-foreground" /></div></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Phone size={12} />{client.phone || "Sin teléfono"}</span><span className="flex items-center gap-1"><MapPin size={12} />{client.branches?.length ?? 0} sede(s)</span><span className="flex items-center gap-1"><AlertCircle size={12} />{pending} pendiente(s)</span>{balance > 0 && <span className="font-semibold text-red-600">Por cobrar: {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(balance)}</span>}</div></div></div>
      </button>;
    })}</div>}
    {showForm && <Modal title="Nuevo cliente" onClose={() => setShowForm(false)}><ClientForm saving={saving} onCancel={() => setShowForm(false)} onSave={save} /></Modal>}
  </div>;
}

export function ClientDetailScreen({ clientId, canAdminister = false, onBack, onNav, onSelectLocation }: { clientId: string; canAdminister?: boolean; onBack: () => void; onNav: (screen: ClientNavigationScreen) => void; onSelectLocation: (id: string) => void }) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"client" | "branch" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [clientResult, branchResult] = await Promise.all([
      supabase.from("clients").select("id,name,document_type,document_number,phone,email,billing_address,main_contact_name,main_contact_phone,notes,is_active,work_orders(id,status),invoices(grand_total,status,payments(amount))").eq("id", clientId).single(),
      supabase.from("branches").select("id,client_id,name,address,manager_name,manager_phone,notes,is_active,areas(id),assets(id),work_orders(id,status)").eq("client_id", clientId).order("name"),
    ]);
    if (clientResult.error) setError(errorMessage(clientResult.error)); else setClient(clientResult.data as ClientRecord);
    if (branchResult.error) setError(errorMessage(branchResult.error)); else setBranches((branchResult.data ?? []) as BranchRecord[]);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  const saveClient = async (value: ClientFormValue) => { setSaving(true); const { error: updateError } = await supabase.from("clients").update({ ...cleanPayload(value), name: value.name.trim() }).eq("id", clientId); setSaving(false); if (updateError) throw updateError; setModal(null); setSuccess("Cliente actualizado."); await load(); };
  const saveBranch = async (value: BranchFormValue) => { setSaving(true); const { error: insertError } = await supabase.from("branches").insert({ ...cleanPayload(value), name: value.name.trim(), client_id: clientId, is_active: true }); setSaving(false); if (insertError) throw insertError; setModal(null); setSuccess("Sede creada correctamente."); await load(); };
  const toggleClient = async () => { if (!client) return; setSaving(true); const { error: updateError } = await supabase.from("clients").update({ is_active: !client.is_active }).eq("id", client.id); setSaving(false); if (updateError) return setError(errorMessage(updateError)); setSuccess(client.is_active ? "Cliente desactivado." : "Cliente reactivado."); await load(); };
  const removeClient = async () => { if (!client) return; setSaving(true); setError(""); try { if (client.is_active) throw new Error("Desactiva el cliente antes de eliminarlo."); if (await requestControlledDeletion("client", client.id, client.name)) onBack(); } catch (deleteError) { setError(errorMessage(deleteError)); } finally { setSaving(false); } };

  if (loading) return <LoadingState />;
  if (!client) return <div><PageTitle title="Cliente no encontrado" back onBack={onBack} /><Feedback error={error || "No existe o no tienes permiso para consultarlo."} /></div>;
  const pending = client.work_orders?.filter((order) => !["completed", "cancelled", "invoiced"].includes(order.status)).length ?? 0;
  const balance = client.invoices?.filter((invoice) => !["paid", "void"].includes(invoice.status)).reduce((total, invoice) => total + Math.max(Number(invoice.grand_total) - (invoice.payments?.reduce((paid, payment) => paid + Number(payment.amount), 0) ?? 0), 0), 0) ?? 0;
  return <div><PageTitle title={client.name} subtitle={[client.document_type, client.document_number].filter(Boolean).join(": ") || "Sin documento"} back onBack={onBack} action={<div className="flex gap-2">{canAdminister && <button type="button" disabled={saving} onClick={() => void removeClient()} title="Solo se elimina si no tiene información relacionada" className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-600 disabled:opacity-50" aria-label="Eliminar cliente"><Trash2 size={15} /></button>}<button onClick={() => setModal("client")} className="flex items-center gap-2 border border-border bg-card hover:bg-muted px-3 py-2 rounded-lg text-sm font-semibold"><Edit3 size={15} /><span className="hidden sm:inline">Editar</span></button></div>} /><Feedback error={error} success={success} />
    <div className="grid md:grid-cols-2 gap-3 mb-6"><div className="bg-card rounded-xl border border-border p-4 shadow-sm"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Información de contacto</h3><div className="space-y-2 text-sm"><p className="flex gap-2"><Phone size={15} className="text-muted-foreground" />{client.phone || "Sin teléfono"}</p><p className="flex gap-2"><Mail size={15} className="text-muted-foreground" />{client.email || "Sin correo"}</p><p className="flex gap-2"><Building2 size={15} className="text-muted-foreground" />{client.billing_address || "Sin dirección de facturación"}</p><p className="flex gap-2"><User size={15} className="text-muted-foreground" />{client.main_contact_name || "Sin contacto principal"}</p></div></div><div className="bg-card rounded-xl border border-border p-4 shadow-sm"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen</h3><div className="space-y-3 text-sm"><p className="flex justify-between"><span className="text-muted-foreground">Por cobrar</span><strong className="text-red-600">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(balance)}</strong></p><p className="flex justify-between"><span className="text-muted-foreground">Trabajos pendientes</span><strong>{pending}</strong></p><p className="flex justify-between"><span className="text-muted-foreground">Sedes</span><strong>{branches.length}</strong></p><p className="flex justify-between"><span className="text-muted-foreground">Estado</span><span className={`font-semibold ${client.is_active ? "text-green-700" : "text-slate-500"}`}>{client.is_active ? "Activo" : "Inactivo"}</span></p></div><button disabled={saving} onClick={() => void toggleClient()} className="mt-4 text-xs font-semibold text-[#f97316] hover:underline">{client.is_active ? "Desactivar cliente" : "Reactivar cliente"}</button></div></div>
    <div className="flex items-center justify-between mb-3"><h2 className="font-bold">Sedes</h2><button onClick={() => setModal("branch")} className="flex items-center gap-1 text-sm text-[#f97316] font-semibold hover:underline"><Plus size={15} />Agregar sede</button></div>
    {branches.length === 0 ? <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center"><MapPin className="mx-auto text-muted-foreground" /><h3 className="mt-3 font-semibold">Este cliente aún no tiene sedes</h3><button onClick={() => setModal("branch")} className="mt-4 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold">Crear primera sede</button></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{branches.map((branch) => <button key={branch.id} onClick={() => { onSelectLocation(branch.id); onNav("location-detail"); }} className="bg-card rounded-xl border border-border p-4 text-left shadow-sm hover:shadow-md hover:border-orange-200"><div className="flex justify-between"><div className="h-9 w-9 rounded-lg bg-muted grid place-items-center text-[#1a3558]"><MapPin size={17} /></div><span className={`text-xs rounded px-2 py-1 ${branch.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{branch.is_active ? "Activa" : "Inactiva"}</span></div><h3 className="font-semibold mt-3">{branch.name}</h3><p className="text-xs text-muted-foreground mt-1 min-h-8">{branch.address || "Sin dirección"}</p><div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex justify-between"><span>{branch.assets?.length ?? 0} equipos</span><span>{branch.work_orders?.filter((item) => !["completed", "cancelled", "invoiced"].includes(item.status)).length ?? 0} pendientes</span></div></button>)}</div>}
    {modal === "client" && <Modal title="Editar cliente" onClose={() => setModal(null)}><ClientForm initial={client} saving={saving} onCancel={() => setModal(null)} onSave={saveClient} /></Modal>}
    {modal === "branch" && <Modal title="Nueva sede" onClose={() => setModal(null)}><BranchForm saving={saving} onCancel={() => setModal(null)} onSave={saveBranch} /></Modal>}
  </div>;
}

export function LocationDetailScreen({ locationId, canAdminister = false, onBack, onNewWorkOrder, onOpenWorkOrder }: { locationId: string; canAdminister?: boolean; onBack: () => void; onNewWorkOrder: (clientId: string, branchId: string, assetId?: string) => void; onOpenWorkOrder: (orderId: string) => void }) {
  const [branch, setBranch] = useState<BranchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => { setLoading(true); const { data, error: queryError } = await supabase.from("branches").select("id,client_id,name,address,manager_name,manager_phone,notes,is_active,clients(id,name),areas(id),assets(id),work_orders(id,status)").eq("id", locationId).single(); if (queryError) setError(errorMessage(queryError)); else setBranch(data as unknown as BranchRecord); setLoading(false); }, [locationId]);
  useEffect(() => { void load(); }, [load]);
  const save = async (value: BranchFormValue) => { setSaving(true); const { error: updateError } = await supabase.from("branches").update({ ...cleanPayload(value), name: value.name.trim() }).eq("id", locationId); setSaving(false); if (updateError) throw updateError; setEditing(false); setSuccess("Sede actualizada."); await load(); };
  const toggle = async () => { if (!branch) return; setSaving(true); const { error: updateError } = await supabase.from("branches").update({ is_active: !branch.is_active }).eq("id", branch.id); setSaving(false); if (updateError) return setError(errorMessage(updateError)); setSuccess(branch.is_active ? "Sede desactivada." : "Sede reactivada."); await load(); };
  const removeBranch = async () => { if (!branch) return; setSaving(true); setError(""); try { if (branch.is_active) throw new Error("Desactiva la sede antes de eliminarla."); if (await requestControlledDeletion("branch", branch.id, branch.name)) onBack(); } catch (deleteError) { setError(errorMessage(deleteError)); } finally { setSaving(false); } };
  if (loading) return <LoadingState />;
  if (!branch) return <div><PageTitle title="Sede no encontrada" back onBack={onBack} /><Feedback error={error || "No existe o no tienes permiso para consultarla."} /></div>;
  const pending = branch.work_orders?.filter((item) => !["completed", "cancelled", "invoiced"].includes(item.status)).length ?? 0;
  return <div><PageTitle title={branch.name} subtitle={`${branch.clients?.name ?? "Cliente"} · ${branch.address || "Sin dirección"}`} back onBack={onBack} action={<div className="flex gap-2">{canAdminister && <button type="button" disabled={saving} onClick={() => void removeBranch()} title="Solo se elimina si no tiene información relacionada" className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-600 disabled:opacity-50" aria-label="Eliminar sede"><Trash2 size={15} /></button>}<button onClick={() => setEditing(true)} className="flex items-center gap-2 border border-border bg-card hover:bg-muted px-3 py-2 rounded-lg text-sm font-semibold"><Edit3 size={15} />Editar</button></div>} /><Feedback error={error} success={success} />
    <div className="grid md:grid-cols-3 gap-3 mb-5"><div className="md:col-span-2 bg-card rounded-xl border border-border p-4 shadow-sm"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Información de sede</h3><div className="grid sm:grid-cols-2 gap-3 text-sm"><p><span className="text-muted-foreground">Encargado: </span><strong>{branch.manager_name || "Sin registrar"}</strong></p><p><span className="text-muted-foreground">Teléfono: </span><strong>{branch.manager_phone || "Sin registrar"}</strong></p><p className="sm:col-span-2"><span className="text-muted-foreground">Dirección: </span><strong>{branch.address || "Sin registrar"}</strong></p></div></div><div className="bg-card rounded-xl border border-border p-4 shadow-sm"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Estado</h3><p className={`font-semibold ${branch.is_active ? "text-green-700" : "text-slate-500"}`}>{branch.is_active ? "Activa" : "Inactiva"}</p><p className="text-xs text-muted-foreground mt-2">{pending} trabajo(s) pendiente(s)</p><button disabled={saving} onClick={() => void toggle()} className="mt-4 text-xs font-semibold text-[#f97316] hover:underline">{branch.is_active ? "Desactivar sede" : "Reactivar sede"}</button></div></div>
    <div className="grid sm:grid-cols-3 gap-3"><div className="bg-card rounded-xl border border-border p-5"><p className="text-sm text-muted-foreground">Áreas registradas</p><p className="text-3xl font-bold mt-2">{branch.areas?.length ?? 0}</p></div><div className="bg-card rounded-xl border border-border p-5"><p className="text-sm text-muted-foreground">Equipos registrados</p><p className="text-3xl font-bold mt-2">{branch.assets?.length ?? 0}</p></div><div className="bg-card rounded-xl border border-border p-5"><p className="text-sm text-muted-foreground">Trabajos pendientes</p><p className="text-3xl font-bold mt-2">{pending}</p></div></div>
    <AssetManagement branchId={branch.id} canAdminister={canAdminister} onNewWorkOrder={(assetId) => onNewWorkOrder(branch.client_id, branch.id, assetId)} onOpenOrder={onOpenWorkOrder} />
    <TechnicalHistory branchId={branch.id} onNewWorkOrder={(assetId) => onNewWorkOrder(branch.client_id, branch.id, assetId)} onOpenOrder={onOpenWorkOrder} />
    {editing && <Modal title="Editar sede" onClose={() => setEditing(false)}><BranchForm initial={branch} saving={saving} onCancel={() => setEditing(false)} onSave={save} /></Modal>}
  </div>;
}
