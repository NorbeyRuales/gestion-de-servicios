import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, ClipboardList,
  DollarSign, Download, FileDown, FileText, Loader2, Package, Plus, Search, Trash2, Wrench,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { requestControlledDeletion } from "../../lib/adminDeletion";
import { QUERY_LIMITS } from "../../lib/queryLimits";
import { WorkOrderPhotos } from "./WorkOrderPhotos";
import { exportSingleWorkOrderPdf } from "../reports/workReportPdf";
import { exportQuotePdf } from "./quotePdf";

type WorkOrderStatus = "pending" | "quoted" | "approved" | "in_progress" | "completed" | "cancelled" | "invoiced";
type ItemType = "material" | "spare_part" | "labor" | "transport" | "rental" | "other";

interface Option { id: string; name: string; area_id?: string | null }
interface TechnicianOption { id: string; name: string; specialty: string | null; company: string | null; is_active: boolean }
interface WorkItem { id?: string; item_type: ItemType; description: string; quantity: number; unit_price: number }

interface WorkOrderListRecord {
  id: string;
  code: string;
  status: WorkOrderStatus;
  scheduled_date: string | null;
  start_date: string | null;
  completion_date: string | null;
  created_at: string;
  reported_problem: string | null;
  work_performed: string | null;
  clients: Option | null;
  branches: Option | null;
  service_types: Option | null;
  work_order_items: { subtotal: number }[];
}

interface WorkOrderRecord {
  id: string;
  code: string;
  client_id: string;
  execution_branch_id: string;
  area_id: string | null;
  asset_id: string | null;
  service_type_id: string;
  assigned_to: string | null;
  technician_id: string | null;
  scheduled_date: string | null;
  start_date: string | null;
  completion_date: string | null;
  reported_problem: string | null;
  work_performed: string | null;
  observations: string | null;
  pending_items: string | null;
  status: WorkOrderStatus;
  work_order_items: WorkItem[];
}

const statusLabels: Record<WorkOrderStatus, string> = {
  pending: "Pendiente", quoted: "Cotizado", approved: "Aprobado", in_progress: "En proceso",
  completed: "Terminado", cancelled: "Cancelado", invoiced: "Facturado",
};
const statusStyles: Record<WorkOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700", quoted: "bg-violet-50 text-violet-700", approved: "bg-cyan-50 text-cyan-700",
  in_progress: "bg-blue-50 text-blue-700", completed: "bg-green-50 text-green-700", cancelled: "bg-red-50 text-red-700", invoiced: "bg-purple-50 text-purple-700",
};
const itemLabels: Record<ItemType, string> = { material: "Material", spare_part: "Repuesto", labor: "Mano de obra", transport: "Transporte", rental: "Alquiler", other: "Otro" };
const inputClass = "w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function formatMoney(value: number) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value); }
function messageFrom(error: unknown) {
  if (!error) return "No fue posible completar la operación.";
  const fallback = "No fue posible completar la operación.";
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

  if (message.includes("Debes registrar el trabajo realizado")) return "Debes registrar el trabajo realizado antes de terminar la orden.";
  if (message.includes("El equipo seleccionado pertenece a otra área")) return "El equipo seleccionado pertenece a otra área.";
  if (message.includes("No se puede modificar una orden facturada")) return "No se puede modificar una orden facturada.";
  return message.replace(/^.*?: /, "") || fallback;
}
function localDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("es-CO") : "Sin fecha"; }

function PageTitle({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 mb-5"><div className="flex items-start gap-2">{onBack && <button onClick={onBack} className="h-8 w-8 grid place-items-center rounded hover:bg-muted" aria-label="Volver"><ArrowLeft size={18} /></button>}<div><h1 className="text-xl sm:text-2xl font-bold">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}</div></div>{action}</div>;
}

function Feedback({ error, success }: { error: string; success?: string }) {
  if (!error && !success) return null;
  return <div role={error ? "alert" : undefined} className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>{error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{error || success}</div>;
}

export function WorkOrdersScreen({ canAdminister = false, onCreate, onEdit }: { canAdminister?: boolean; onCreate: () => void; onEdit: (id: string) => void }) {
  const [orders, setOrders] = useState<WorkOrderListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [exportingId, setExportingId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WorkOrderStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("work_orders").select("id,code,status,scheduled_date,start_date,completion_date,created_at,reported_problem,work_performed,clients(id,name),branches(id,name),service_types(id,name),work_order_items(subtotal)").order("created_at", { ascending: false }).limit(QUERY_LIMITS.list);
    if (queryError) setError(messageFrom(queryError)); else setOrders((data ?? []) as unknown as WorkOrderListRecord[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    const term = search.toLowerCase();
    return matchesStatus && [order.code, order.clients?.name, order.branches?.name, order.reported_problem, order.work_performed].some((value) => value?.toLowerCase().includes(term));
  }), [orders, search, status]);

  const removeOrder = async (order: WorkOrderListRecord) => {
    setDeletingId(order.id); setError(""); setSuccess("");
    try {
      if (await requestControlledDeletion("work_order", order.id, `orden ${order.code}`)) {
        setSuccess(`Orden ${order.code} eliminada correctamente.`);
        await load();
      }
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setDeletingId("");
    }
  };

  const exportQuickReport = async (order: WorkOrderListRecord) => {
    setExportingId(order.id); setError(""); setSuccess("");
    try {
      await exportSingleWorkOrderPdf(order.id);
    } catch (exportError) {
      setError(`No fue posible generar el reporte de ${order.code}: ${messageFrom(exportError)}`);
    } finally {
      setExportingId("");
    }
  };

  const exportQuickQuote = async (order: WorkOrderListRecord) => {
    setExportingId(order.id); setError(""); setSuccess("");
    try { await exportQuotePdf(order.id); }
    catch (exportError) { setError(`No fue posible generar la cotización de ${order.code}: ${messageFrom(exportError)}`); }
    finally { setExportingId(""); }
  };

  const changeStatus = async (order: WorkOrderListRecord, nextStatus: WorkOrderStatus) => {
    if (nextStatus === order.status) return;
    if (nextStatus === "completed" && !order.work_performed?.trim()) {
      setError("Debes registrar el trabajo realizado antes de terminar la orden.");
      return;
    }
    if (nextStatus === "invoiced") {
      setError("El estado facturado se asigna al generar la factura.");
      return;
    }
    setUpdatingStatusId(order.id); setError(""); setSuccess("");
    try {
      const now = new Date().toISOString();
      const automaticCompletion = order.start_date && new Date(order.start_date).getTime() > new Date(now).getTime()
        ? order.start_date
        : now;
      const dates = {
        start_date: nextStatus === "in_progress" ? order.start_date || now : order.start_date,
        completion_date: nextStatus === "completed" ? order.completion_date || automaticCompletion : null,
      };
      const { error: updateError } = await supabase.from("work_orders").update({ status: nextStatus, ...dates }).eq("id", order.id);
      if (updateError) throw updateError;
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: nextStatus, ...dates } : item));
      setSuccess(`La orden ${order.code} cambió a ${statusLabels[nextStatus]}.`);
    } catch (updateError) {
      setError(messageFrom(updateError));
    } finally {
      setUpdatingStatusId("");
    }
  };

  return <div><PageTitle title="Órdenes de trabajo" subtitle={`${orders.length} orden${orders.length === 1 ? "" : "es"} registrada${orders.length === 1 ? "" : "s"}`} action={<button onClick={onCreate} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus size={16} />Nueva orden</button>} /><Feedback error={error} success={success} />
    <div className="grid sm:grid-cols-[1fr_190px] gap-3 mb-4"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, cliente, sede o descripción…" /></div><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as WorkOrderStatus | "all")}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {loading ? <div className="py-20 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? <div className="bg-card border border-dashed border-border rounded-2xl p-14 text-center"><ClipboardList className="mx-auto text-muted-foreground" /><h2 className="mt-3 font-bold">{orders.length ? "No hay coincidencias" : "Aún no hay órdenes"}</h2>{!orders.length && <button onClick={onCreate} className="mt-4 bg-[#f97316] text-white rounded-lg px-4 py-2 font-semibold">Crear primera orden</button>}</div> : <div className="space-y-3">{filtered.map((order) => { const total = order.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0); const canDelete = canAdminister && ["pending", "cancelled"].includes(order.status); const canExport = ["completed", "invoiced"].includes(order.status); const canQuote = order.status === "quoted"; const isInvoiced = order.status === "invoiced"; return <article key={order.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-orange-200 hover:shadow-md sm:flex-row"><button type="button" onClick={() => onEdit(order.id)} className="min-w-0 flex-1 p-4 text-left"><div className="flex items-start gap-3"><div className="h-10 w-10 rounded-lg bg-muted text-[#1a3558] grid place-items-center shrink-0"><Wrench size={18} /></div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-sm">{order.reported_problem || order.work_performed || "Orden sin descripción"}</h3><p className="text-xs font-mono text-muted-foreground mt-0.5">{order.code}</p></div><ChevronRight size={16} className="shrink-0 text-muted-foreground" /></div><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground"><span>{order.clients?.name}</span><span>{order.branches?.name}</span><span>{order.service_types?.name}</span><span>{localDate(order.scheduled_date || order.created_at)}</span><strong className="w-full text-foreground sm:ml-auto sm:w-auto">{formatMoney(total)}</strong></div></div></div></button><div className="flex min-w-0 items-center justify-between border-t border-border px-4 py-3 sm:grid sm:min-w-36 sm:place-items-center sm:border-t-0 sm:px-3 sm:py-0"><span className="text-xs text-muted-foreground sm:hidden">Estado</span><div className="relative max-w-full">{updatingStatusId === order.id && <Loader2 size={14} className="absolute -left-5 top-2 animate-spin text-muted-foreground" />}<select aria-label={`Estado de la orden ${order.code}`} disabled={isInvoiced || updatingStatusId === order.id} value={order.status} onChange={(event) => void changeStatus(order, event.target.value as WorkOrderStatus)} className={`max-w-full cursor-pointer appearance-none rounded px-2.5 py-1.5 pr-7 text-xs font-semibold outline-none ring-offset-2 focus:ring-2 disabled:cursor-not-allowed ${statusStyles[order.status]}`}>{Object.entries(statusLabels).filter(([value]) => value !== "invoiced" || isInvoiced).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>{(canQuote || canExport || canDelete) && <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:grid sm:place-items-center sm:border-l sm:border-t-0 sm:px-3 sm:py-0">{canQuote && <button type="button" disabled={exportingId === order.id} onClick={() => void exportQuickQuote(order)} title="Descargar cotización PDF" aria-label={`Descargar cotización PDF de ${order.code}`} className="grid h-9 w-9 place-items-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50">{exportingId === order.id ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}</button>}{canExport && <button type="button" disabled={exportingId === order.id} onClick={() => void exportQuickReport(order)} title="Descargar reporte PDF" aria-label={`Descargar reporte PDF de ${order.code}`} className="grid h-9 w-9 place-items-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50">{exportingId === order.id ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={16} />}</button>}{canDelete && <button type="button" disabled={deletingId === order.id} onClick={() => void removeOrder(order)} title="Eliminar orden" aria-label={`Eliminar orden ${order.code}`} className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">{deletingId === order.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>}</div>}</article>; })}</div>}
  </div>;
}

export function WorkOrderFormScreen({ orderId, initialClientId, initialBranchId, initialAssetId, canAdminister = false, onBack, onSaved }: { orderId?: string; initialClientId?: string; initialBranchId?: string; initialAssetId?: string; canAdminister?: boolean; onBack: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [assets, setAssets] = useState<Option[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Option[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [branchId, setBranchId] = useState(initialBranchId ?? "");
  const [areaId, setAreaId] = useState("");
  const [assetId, setAssetId] = useState(initialAssetId ?? "");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [status, setStatus] = useState<WorkOrderStatus>("pending");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [reportedProblem, setReportedProblem] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [observations, setObservations] = useState("");
  const [pendingItems, setPendingItems] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [orderCode, setOrderCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [clientsResult, typesResult, techniciansResult] = await Promise.all([
        supabase.from("clients").select("id,name").eq("is_active", true).order("name"),
        supabase.from("service_types").select("id,name").eq("is_active", true).order("sort_order"),
        supabase.from("technicians").select("id,name,specialty,company,is_active").order("name"),
      ]);
      const firstError = clientsResult.error || typesResult.error || techniciansResult.error;
      if (firstError) setError(messageFrom(firstError));
      setClients((clientsResult.data ?? []) as Option[]); setServiceTypes((typesResult.data ?? []) as Option[]); setTechnicians((techniciansResult.data ?? []) as TechnicianOption[]);
      if (!orderId) { setServiceTypeId(typesResult.data?.[0]?.id ?? ""); setLoading(false); return; }
      const { data, error: orderError } = await supabase.from("work_orders").select("id,code,client_id,execution_branch_id,area_id,asset_id,service_type_id,assigned_to,technician_id,scheduled_date,start_date,completion_date,reported_problem,work_performed,observations,pending_items,status,work_order_items(id,item_type,description,quantity,unit_price)").eq("id", orderId).single();
      if (orderError) setError(messageFrom(orderError)); else if (data) {
        const order = data as unknown as WorkOrderRecord;
        setOrderCode(order.code); setClientId(order.client_id); setBranchId(order.execution_branch_id); setAreaId(order.area_id ?? ""); setAssetId(order.asset_id ?? ""); setServiceTypeId(order.service_type_id); setTechnicianId(order.technician_id ?? ""); setScheduledDate(order.scheduled_date ?? ""); setStartDate(order.start_date?.slice(0, 16) ?? ""); setCompletionDate(order.completion_date?.slice(0, 16) ?? ""); setReportedProblem(order.reported_problem ?? ""); setWorkPerformed(order.work_performed ?? ""); setObservations(order.observations ?? ""); setPendingItems(order.pending_items ?? ""); setStatus(order.status); setItems(order.work_order_items ?? []);
      }
      setLoading(false);
    })();
  }, [orderId]);

  useEffect(() => { if (!clientId) { setBranches([]); return; } void supabase.from("branches").select("id,name").eq("client_id", clientId).eq("is_active", true).order("name").then(({ data, error: queryError }) => { if (queryError) setError(messageFrom(queryError)); else setBranches((data ?? []) as Option[]); }); }, [clientId]);
  useEffect(() => { if (!branchId) { setAreas([]); setAssets([]); return; } void Promise.all([supabase.from("areas").select("id,name").eq("branch_id", branchId).eq("is_active", true).order("name"), supabase.from("assets").select("id,name,area_id").eq("branch_id", branchId).eq("is_active", true).order("name")]).then(([areaResult, assetResult]) => { if (areaResult.error || assetResult.error) setError(messageFrom(areaResult.error || assetResult.error)); else { setAreas((areaResult.data ?? []) as Option[]); setAssets((assetResult.data ?? []) as Option[]); } }); }, [branchId]);

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const updateItem = (index: number, key: keyof WorkItem, value: string | number) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const addItem = () => setItems((current) => [...current, { id: crypto.randomUUID(), item_type: "material", description: "", quantity: 1, unit_price: 0 }]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!clientId || !branchId || !serviceTypeId) return setError("Selecciona cliente, sede y tipo de servicio.");
    if (!reportedProblem.trim() && !workPerformed.trim()) return setError("Registra el problema reportado o el trabajo realizado.");
    if (["completed", "invoiced"].includes(status) && !workPerformed.trim()) return setError("Debes registrar el trabajo realizado para terminar la orden.");
    if (items.some((item) => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.unit_price) < 0)) return setError("Completa correctamente todos los ítems de costo.");
    setSaving(true);
    try {
      const { error: saveError } = await supabase.rpc("save_work_order_with_technician", { payload: { id: orderId ?? null, client_id: clientId, execution_branch_id: branchId, area_id: areaId || null, asset_id: assetId || null, service_type_id: serviceTypeId, technician_id: technicianId || null, scheduled_date: scheduledDate || null, start_date: startDate ? new Date(startDate).toISOString() : null, completion_date: completionDate ? new Date(completionDate).toISOString() : null, reported_problem: reportedProblem, work_performed: workPerformed, observations, pending_items: pendingItems, status, items: items.map(({ item_type, description, quantity, unit_price }) => ({ item_type, description: description.trim(), quantity: Number(quantity), unit_price: Number(unit_price) })) } });
      if (saveError) return setError(messageFrom(saveError));
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const removeOrder = async () => {
    if (!orderId) return;
    setError("");
    setSaving(true);
    try {
      if (await requestControlledDeletion("work_order", orderId, `orden ${orderCode || orderId}`)) onSaved();
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setSaving(false);
    }
  };

  const exportReport = async () => {
    if (!orderId) return;
    setError(""); setExporting(true);
    try { await exportSingleWorkOrderPdf(orderId); }
    catch (exportError) { setError(`No fue posible generar el reporte: ${messageFrom(exportError)}`); }
    finally { setExporting(false); }
  };

  const exportQuote = async () => {
    if (!orderId) return;
    setError(""); setExporting(true);
    try { await exportQuotePdf(orderId); }
    catch (exportError) { setError(`No fue posible generar la cotización: ${messageFrom(exportError)}`); }
    finally { setExporting(false); }
  };

  if (loading) return <div className="py-20 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  const locked = status === "invoiced";
  return <div><PageTitle title={orderId ? "Editar orden de trabajo" : "Nueva orden de trabajo"} subtitle="Registra el servicio, la ejecución y todos sus costos" onBack={onBack} /><Feedback error={error} />
    <form onSubmit={submit} className="space-y-5"><fieldset disabled={locked || saving} className="space-y-5">
      <section className="bg-card rounded-xl border border-border p-5 shadow-sm"><h2 className="font-bold flex items-center gap-2 mb-4"><ClipboardList size={18} className="text-[#f97316]" />Información principal</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="text-sm font-semibold">Cliente *<select required className={`${inputClass} mt-1.5`} value={clientId} onChange={(event) => { setClientId(event.target.value); setBranchId(""); setAreaId(""); setAssetId(""); }}><option value="">Selecciona…</option>{clients.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Sede de ejecución *<select required className={`${inputClass} mt-1.5`} value={branchId} onChange={(event) => { setBranchId(event.target.value); setAreaId(""); setAssetId(""); }}><option value="">Selecciona…</option>{branches.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Tipo de servicio *<select required className={`${inputClass} mt-1.5`} value={serviceTypeId} onChange={(event) => setServiceTypeId(event.target.value)}><option value="">Selecciona…</option>{serviceTypes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Área<select className={`${inputClass} mt-1.5`} value={areaId} onChange={(event) => { setAreaId(event.target.value); setAssetId(""); }}><option value="">Sin área específica</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Equipo<select className={`${inputClass} mt-1.5`} value={assetId} onChange={(event) => { const nextId = event.target.value; setAssetId(nextId); const selected = assets.find((asset) => asset.id === nextId); if (selected?.area_id) setAreaId(selected.area_id); }}><option value="">Sin equipo asociado</option>{assets.filter((option) => !areaId || !option.area_id || option.area_id === areaId).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Técnico<select className={`${inputClass} mt-1.5`} value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}><option value="">Sin asignar</option>{technicians.filter((option) => option.is_active || option.id === technicianId).map((option) => <option key={option.id} value={option.id} disabled={!option.is_active}>{option.name}{option.specialty ? ` · ${option.specialty}` : ""}{option.company ? ` (${option.company})` : ""}{!option.is_active ? " · Inactivo" : ""}</option>)}</select></label>
        <label className="text-sm font-semibold">Estado<select className={`${inputClass} mt-1.5`} value={status} onChange={(event) => setStatus(event.target.value as WorkOrderStatus)}>{Object.entries(statusLabels).filter(([value]) => value !== "invoiced" || status === "invoiced").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold">Fecha programada<input type="date" className={`${inputClass} mt-1.5`} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label>
        <label className="text-sm font-semibold">Inicio<input type="datetime-local" className={`${inputClass} mt-1.5`} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="text-sm font-semibold">Finalización<input type="datetime-local" className={`${inputClass} mt-1.5`} value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} /></label>
      </div></section>
      <section className="bg-card rounded-xl border border-border p-5 shadow-sm"><h2 className="font-bold flex items-center gap-2 mb-4"><Wrench size={18} className="text-[#f97316]" />Descripción del servicio</h2><div className="grid md:grid-cols-2 gap-4"><label className="text-sm font-semibold">Problema reportado<textarea rows={4} className={`${inputClass} mt-1.5`} value={reportedProblem} onChange={(event) => setReportedProblem(event.target.value)} /></label><label className="text-sm font-semibold">Trabajo realizado<textarea rows={4} className={`${inputClass} mt-1.5`} value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} /></label><label className="text-sm font-semibold">Observaciones<textarea rows={3} className={`${inputClass} mt-1.5`} value={observations} onChange={(event) => setObservations(event.target.value)} /></label><label className="text-sm font-semibold">Pendientes por resolver<textarea rows={3} className={`${inputClass} mt-1.5`} value={pendingItems} onChange={(event) => setPendingItems(event.target.value)} /></label></div></section>
      <section className="bg-card rounded-xl border border-border p-5 shadow-sm"><div className="flex justify-between items-center mb-4"><h2 className="font-bold flex items-center gap-2"><DollarSign size={18} className="text-[#f97316]" />Costos</h2><button type="button" onClick={addItem} className="flex items-center gap-1 text-sm font-semibold text-[#f97316]"><Plus size={15} />Agregar ítem</button></div>{items.length === 0 ? <div className="border border-dashed border-border rounded-lg p-7 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-2" />No hay costos registrados. Puedes guardar una orden sin costo.</div> : <div className="space-y-3">{items.map((item, index) => <div key={item.id ?? index} className="grid grid-cols-2 lg:grid-cols-[160px_1fr_100px_150px_40px] gap-2 items-end border border-border rounded-lg p-3"><label className="text-xs font-semibold">Tipo<select className={`${inputClass} mt-1`} value={item.item_type} onChange={(event) => updateItem(index, "item_type", event.target.value)}>{Object.entries(itemLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold col-span-2 lg:col-span-1">Descripción<input className={`${inputClass} mt-1`} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></label><label className="text-xs font-semibold">Cantidad<input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0" className={`${inputClass} mt-1`} value={item.quantity || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "quantity", Number(event.target.value))} /></label><label className="text-xs font-semibold">Valor unitario<input type="number" min="0" step="1" inputMode="numeric" placeholder="$ 0" className={`${inputClass} mt-1`} value={item.unit_price || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem(index, "unit_price", Number(event.target.value))} /></label><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="h-10 grid place-items-center text-red-500 hover:bg-red-50 rounded" aria-label="Eliminar ítem"><Trash2 size={16} /></button></div>)}</div>}<div className="mt-5 flex justify-end"><div className="bg-[#1a3558] text-white rounded-xl px-5 py-3 min-w-56 flex justify-between gap-6"><span>Total</span><strong className="font-semibold tabular-nums">{formatMoney(total)}</strong></div></div></section>
    </fieldset><div className="sticky bottom-3 bg-card/95 backdrop-blur border border-border shadow-lg rounded-xl p-3 flex flex-wrap justify-end gap-2">{canAdminister && orderId && ["pending", "cancelled"].includes(status) && <button type="button" disabled={saving} onClick={() => void removeOrder()} className="mr-auto flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"><Trash2 size={15} />Eliminar orden</button>}{orderId && status === "quoted" && <button type="button" disabled={exporting} onClick={() => void exportQuote()} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 disabled:opacity-60">{exporting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}Cotización PDF</button>}{orderId && ["completed", "invoiced"].includes(status) && <button type="button" disabled={exporting} onClick={() => void exportReport()} className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 disabled:opacity-60">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}Reporte PDF</button>}<button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-border">Cancelar</button>{!locked && <button disabled={saving} className="px-5 py-2 rounded-lg bg-[#f97316] text-white font-semibold flex items-center gap-2 disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}Guardar orden</button>}</div></form>
    <div className="mt-5">{orderId ? <WorkOrderPhotos workOrderId={orderId} disabled={locked} /> : <section className="bg-card rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-2" />Guarda la orden primero para adjuntar fotografías.</section>}</div>
  </div>;
}
