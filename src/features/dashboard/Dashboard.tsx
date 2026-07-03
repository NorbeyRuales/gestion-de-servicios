import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign,
  ChevronRight, ClipboardList, Clock3, FileText, Loader2, Plus, RefreshCw, Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { QUERY_LIMITS } from "../../lib/queryLimits";

type DashboardTarget = "clients" | "orders" | "new-work-order" | "invoices";
type WorkOrderStatus = "pending" | "quoted" | "approved" | "in_progress" | "completed" | "cancelled" | "invoiced";
type InvoiceStatus = "pending" | "partial" | "paid" | "void";

interface NamedRelation { name: string }
interface WorkOrderRecord {
  id: string;
  code: string;
  status: WorkOrderStatus;
  scheduled_date: string | null;
  completion_date: string | null;
  created_at: string;
  reported_problem: string | null;
  work_performed: string | null;
  clients: NamedRelation | null;
  branches: NamedRelation | null;
  service_types: NamedRelation | null;
  work_order_items: { subtotal: number }[];
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  grand_total: number;
  created_at: string;
  clients: NamedRelation | null;
  payments: { amount: number }[];
}

const orderLabels: Record<WorkOrderStatus, string> = {
  pending: "Pendiente",
  quoted: "Cotizada",
  approved: "Aprobada",
  in_progress: "En proceso",
  completed: "Terminada",
  cancelled: "Cancelada",
  invoiced: "Facturada",
};

const orderStyles: Record<WorkOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  quoted: "bg-violet-50 text-violet-700",
  approved: "bg-cyan-50 text-cyan-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-slate-100 text-slate-600",
  invoiced: "bg-purple-50 text-purple-700",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO");
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible cargar el dashboard.";
}

function KpiCard({ label, value, detail, icon: Icon, color, onClick }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof ClipboardList;
  color: "orange" | "blue" | "red" | "green";
  onClick: () => void;
}) {
  const colors = {
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-700",
  };
  return <button type="button" onClick={onClick} aria-label={`${label}: ${value}. ${detail}`} className="group relative w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2">
    <div className="mb-3 flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-lg transition-transform group-hover:scale-105 ${colors[color]}`}><Icon size={18} /></span></div>
    <p className="text-2xl font-bold">{value}</p>
    <div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{detail}</p><ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#f97316]" /></div>
  </button>;
}

export function DashboardScreen({ onNavigate }: { onNavigate: (target: DashboardTarget) => void }) {
  const [orders, setOrders] = useState<WorkOrderRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [activeClients, setActiveClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [ordersResult, invoicesResult, clientsResult] = await Promise.all([
      supabase.from("work_orders").select("id,code,status,scheduled_date,completion_date,created_at,reported_problem,work_performed,clients(name),branches(name),service_types(name),work_order_items(subtotal)").order("created_at", { ascending: false }).limit(QUERY_LIMITS.dashboard),
      supabase.from("invoices").select("id,invoice_number,status,issue_date,due_date,grand_total,created_at,clients(name),payments(amount)").order("created_at", { ascending: false }).limit(QUERY_LIMITS.dashboard),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const firstError = ordersResult.error || invoicesResult.error || clientsResult.error;
    if (firstError) setError(errorMessage(firstError));
    if (!ordersResult.error) setOrders((ordersResult.data ?? []) as unknown as WorkOrderRecord[]);
    if (!invoicesResult.error) setInvoices((invoicesResult.data ?? []) as unknown as InvoiceRecord[]);
    if (!clientsResult.error) setActiveClients(clientsResult.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const pending = orders.filter((order) => ["pending", "quoted", "approved"].includes(order.status)).length;
    const inProgress = orders.filter((order) => order.status === "in_progress").length;
    const unbilled = orders.filter((order) => order.status === "completed").length;
    const receivables = invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => {
      const paid = invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0);
      return sum + Math.max(Number(invoice.grand_total) - paid, 0);
    }, 0);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = invoices.filter((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return invoice.status !== "void" && Number(invoice.grand_total) - paid > 0 && Boolean(invoice.due_date && invoice.due_date < today);
    }).length;
    return { pending, inProgress, unbilled, receivables, overdue };
  }, [invoices, orders]);

  const pendingInvoices = useMemo(() => invoices.map((invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { ...invoice, balance: Math.max(Number(invoice.grand_total) - paid, 0) };
  }).filter((invoice) => invoice.status !== "void" && invoice.balance > 0).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).slice(0, 5), [invoices]);

  const today = new Date().toISOString().slice(0, 10);

  return <div>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold sm:text-2xl">Panel principal</h1><p className="mt-0.5 text-sm text-muted-foreground">Resumen actualizado de operaciones y cartera</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} disabled={loading} aria-label="Actualizar dashboard" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card disabled:opacity-60"><RefreshCw size={17} className={loading ? "animate-spin" : ""} /></button><button onClick={() => onNavigate("new-work-order")} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white"><Plus size={16} />Nueva orden</button></div>
    </div>

    {error && <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
    {loading && orders.length === 0 && invoices.length === 0 ? <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pendientes" value={metrics.pending} detail="Por cotizar o iniciar" color="orange" icon={AlertCircle} onClick={() => onNavigate("orders")} />
        <KpiCard label="En proceso" value={metrics.inProgress} detail="Trabajos activos" color="blue" icon={Clock3} onClick={() => onNavigate("orders")} />
        <KpiCard label="Sin facturar" value={metrics.unbilled} detail="Órdenes terminadas" color="red" icon={FileText} onClick={() => onNavigate("invoices")} />
        <KpiCard label="Por cobrar" value={formatMoney(metrics.receivables)} detail="Saldo de facturas" color="green" icon={CircleDollarSign} onClick={() => onNavigate("invoices")} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button onClick={() => onNavigate("clients")} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:border-orange-200"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Users size={18} /></span><span><strong className="block text-sm">{activeClients} clientes activos</strong><span className="text-xs text-muted-foreground">Consultar clientes y sedes</span></span></span><ArrowRight size={17} className="text-muted-foreground" /></button>
        <button onClick={() => onNavigate("invoices")} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:border-orange-200"><span className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${metrics.overdue > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{metrics.overdue > 0 ? <CalendarClock size={18} /> : <CheckCircle2 size={18} />}</span><span><strong className="block text-sm">{metrics.overdue} factura{metrics.overdue === 1 ? "" : "s"} vencida{metrics.overdue === 1 ? "" : "s"}</strong><span className="text-xs text-muted-foreground">Revisar cartera y pagos</span></span></span><ArrowRight size={17} className="text-muted-foreground" /></button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-bold">Órdenes recientes</h2><button onClick={() => onNavigate("orders")} className="text-xs font-semibold text-[#f97316]">Ver todas</button></div>
          {orders.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">No hay órdenes registradas.</p> : <div className="divide-y divide-border">{orders.slice(0, 6).map((order) => {
            const total = order.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0);
            return <button key={order.id} onClick={() => onNavigate("orders")} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{order.code}</span><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${orderStyles[order.status]}`}>{orderLabels[order.status]}</span></div><p className="mt-1 truncate text-sm font-semibold">{order.reported_problem || order.work_performed || "Orden sin descripción"}</p><p className="mt-1 text-xs text-muted-foreground">{order.clients?.name || "Cliente"} · {order.branches?.name || "Sin sede"} · {order.service_types?.name || "Servicio"}</p></div>
              <div className="text-right"><p className="text-sm font-semibold tabular-nums">{formatMoney(total)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.completion_date || order.scheduled_date || order.created_at)}</p></div>
            </button>;
          })}</div>}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-bold">Cartera pendiente</h2><button onClick={() => onNavigate("invoices")} className="text-xs font-semibold text-[#f97316]">Ver facturas</button></div>
          {pendingInvoices.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto mb-2 text-green-600" /><p className="text-sm font-semibold">No hay saldos pendientes</p></div> : <div className="divide-y divide-border">{pendingInvoices.map((invoice) => {
            const overdue = Boolean(invoice.due_date && invoice.due_date < today);
            return <button key={invoice.id} onClick={() => onNavigate("invoices")} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"><div><p className="font-mono text-xs font-bold">{invoice.invoice_number}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.clients?.name || "Cliente"}</p><p className={`mt-1 text-xs ${overdue ? "font-semibold text-red-600" : "text-muted-foreground"}`}>{overdue ? "Vencida" : "Vence"}: {formatDate(invoice.due_date)}</p></div><strong className="text-sm font-semibold tabular-nums text-red-600">{formatMoney(invoice.balance)}</strong></button>;
          })}</div>}
        </section>
      </div>
    </>}
  </div>;
}
