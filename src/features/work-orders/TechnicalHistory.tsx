import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Calendar, Camera, ChevronRight, CircleDollarSign, ClipboardList,
  Cpu, Loader2, Plus, Search, User, Wrench,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type WorkOrderStatus = "pending" | "quoted" | "approved" | "in_progress" | "completed" | "cancelled" | "invoiced";
interface NamedRelation { name: string }
interface AssetOption { id: string; name: string; internal_code: string }
interface HistoryOrder {
  id: string;
  code: string;
  status: WorkOrderStatus;
  asset_id: string | null;
  scheduled_date: string | null;
  start_date: string | null;
  completion_date: string | null;
  created_at: string;
  reported_problem: string | null;
  work_performed: string | null;
  observations: string | null;
  pending_items: string | null;
  service_types: NamedRelation | null;
  profiles: { full_name: string } | null;
  assets: AssetOption | null;
  work_order_items: { subtotal: number; item_type: string }[];
  work_order_photos: { id: string; photo_type: string }[];
}

const statusLabels: Record<WorkOrderStatus, string> = { pending: "Pendiente", quoted: "Cotizada", approved: "Aprobada", in_progress: "En proceso", completed: "Terminada", cancelled: "Cancelada", invoiced: "Facturada" };
const statusStyles: Record<WorkOrderStatus, string> = { pending: "bg-amber-50 text-amber-700", quoted: "bg-violet-50 text-violet-700", approved: "bg-cyan-50 text-cyan-700", in_progress: "bg-blue-50 text-blue-700", completed: "bg-green-50 text-green-700", cancelled: "bg-red-50 text-red-700", invoiced: "bg-purple-50 text-purple-700" };
const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function date(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("es-CO");
}

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible cargar el historial técnico.";
}

export function TechnicalHistory({ branchId, assetId, assetName, onNewWorkOrder, onOpenOrder }: {
  branchId: string;
  assetId?: string;
  assetName?: string;
  onNewWorkOrder: (assetId?: string) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(assetId ?? "");
  const [status, setStatus] = useState<WorkOrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let orderQuery = supabase.from("work_orders").select("id,code,status,asset_id,scheduled_date,start_date,completion_date,created_at,reported_problem,work_performed,observations,pending_items,service_types(name),profiles!work_orders_assigned_to_fkey(full_name),assets(id,name,internal_code),work_order_items(subtotal,item_type),work_order_photos(id,photo_type)").eq("execution_branch_id", branchId).order("created_at", { ascending: false });
    if (assetId) orderQuery = orderQuery.eq("asset_id", assetId);
    const [ordersResult, assetsResult] = await Promise.all([
      orderQuery,
      supabase.from("assets").select("id,name,internal_code").eq("branch_id", branchId).order("name"),
    ]);
    if (ordersResult.error || assetsResult.error) setError(messageFrom(ordersResult.error || assetsResult.error));
    if (!ordersResult.error) setOrders((ordersResult.data ?? []) as unknown as HistoryOrder[]);
    if (!assetsResult.error) setAssets((assetsResult.data ?? []) as AssetOption[]);
    setLoading(false);
  }, [assetId, branchId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => orders.filter((order) => {
    const term = search.toLowerCase();
    const matchesSearch = [order.code, order.reported_problem, order.work_performed, order.observations, order.assets?.name, order.assets?.internal_code, order.service_types?.name].some((value) => value?.toLowerCase().includes(term));
    return matchesSearch && (status === "all" || order.status === status) && (assetId || !selectedAsset || order.asset_id === selectedAsset);
  }), [assetId, orders, search, selectedAsset, status]);

  const totalCost = filtered.reduce((sum, order) => sum + order.work_order_items.reduce((itemSum, item) => itemSum + Number(item.subtotal), 0), 0);
  const completed = filtered.filter((order) => ["completed", "invoiced"].includes(order.status)).length;
  const title = assetId ? `Historial técnico · ${assetName || "Equipo"}` : "Historial técnico de la sede";

  return <section className="mt-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><ClipboardList size={18} className="text-[#f97316]" />{title}</h2><p className="mt-0.5 text-sm text-muted-foreground">Trabajos, mantenimientos, evidencias y costos registrados</p></div><button onClick={() => onNewWorkOrder(assetId || selectedAsset || undefined)} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Registrar trabajo</button></div>
    {error && <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    <div className="mb-4 grid grid-cols-3 gap-2"><div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Registros</p><strong className="text-lg">{filtered.length}</strong></div><div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Terminados</p><strong className="text-lg">{completed}</strong></div><div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Costo acumulado</p><strong className="text-sm font-semibold tabular-nums sm:text-lg">{money(totalCost)}</strong></div></div>
    <div className={`mb-4 grid gap-2 ${assetId ? "sm:grid-cols-[1fr_180px]" : "sm:grid-cols-[1fr_210px_180px]"}`}><div className="relative"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} w-full pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar orden, trabajo o equipo…" /></div>{!assetId && <select className={inputClass} value={selectedAsset} onChange={(event) => setSelectedAsset(event.target.value)}><option value="">Todos los equipos</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.internal_code}</option>)}</select>}<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as WorkOrderStatus | "all")}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {loading ? <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><Wrench className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No hay trabajos para los filtros seleccionados.</p></div> : <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-border">{filtered.map((order) => {
      const orderTotal = order.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const eventDate = order.completion_date || order.start_date || order.scheduled_date || order.created_at;
      return <article key={order.id} className="relative ml-10 rounded-xl border border-border bg-card p-4 shadow-sm"><span className="absolute -left-[30px] top-4 grid h-5 w-5 place-items-center rounded-full border-4 border-background bg-[#f97316]" /><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold">{order.code}</span><span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span></div><h3 className="mt-2 text-sm font-bold">{order.work_performed || order.reported_problem || "Servicio sin descripción"}</h3>{order.reported_problem && order.work_performed && <p className="mt-1 text-xs text-muted-foreground">Problema: {order.reported_problem}</p>}</div><button onClick={() => onOpenOrder(order.id)} className="flex items-center gap-1 text-xs font-semibold text-[#f97316]">Abrir orden<ChevronRight size={14} /></button></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Calendar size={12} />{date(eventDate)}</span><span className="flex items-center gap-1"><Wrench size={12} />{order.service_types?.name || "Servicio"}</span><span className="flex items-center gap-1"><User size={12} />{order.profiles?.full_name || "Sin técnico"}</span>{order.assets && <span className="flex items-center gap-1"><Cpu size={12} />{order.assets.name}</span>}<span className="flex items-center gap-1"><Camera size={12} />{order.work_order_photos.length} evidencia(s)</span><span className="ml-auto flex items-center gap-1 font-mono font-semibold text-foreground"><CircleDollarSign size={12} />{money(orderTotal)}</span></div>{order.pending_items && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><strong>Pendiente:</strong> {order.pending_items}</p>}{order.observations && <p className="mt-2 text-xs text-muted-foreground">{order.observations}</p>}</article>;
    })}</div>}
  </section>;
}
