import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, CalendarRange, CircleDollarSign, Download, FileSpreadsheet,
  FileText, Loader2, Receipt, Trash2, Wrench,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { QUERY_LIMITS } from "../../lib/queryLimits";
import type { ReportExportData } from "./reportExports";
import { InvoiceDeleteModal } from "./InvoiceDeleteModal";
import { exportWorkReportPdf, type WorkReportRow } from "./workReportPdf";
import { ToastFeedback } from "../../components/ToastFeedback";

type InvoiceStatus = "pending" | "partial" | "paid" | "void";
interface NamedRelation { name: string }
interface ClientOption { id: string; name: string }
interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client_id: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  grand_total: number;
  clients: NamedRelation | null;
  payments: { amount: number }[];
}
interface PaymentRecord { invoice_id: string; payment_date: string; amount: number }
interface ServiceRecord {
  id: string;
  code: string;
  client_id: string;
  status: string;
  completion_date: string | null;
  start_date: string | null;
  created_at: string;
  reported_problem: string | null;
  work_performed: string | null;
  observations: string | null;
  pending_items: string | null;
  clients: NamedRelation | null;
  branches: NamedRelation | null;
  service_types: NamedRelation | null;
  areas: NamedRelation | null;
  assets: NamedRelation | null;
  technicians: NamedRelation | null;
  work_order_items: { subtotal: number }[];
}

const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const invoiceLabels: Record<InvoiceStatus, string> = { pending: "Pendiente", partial: "Parcial", paid: "Pagada", void: "Anulada" };
const invoiceStyles: Record<InvoiceStatus, string> = { pending: "bg-amber-50 text-amber-700", partial: "bg-blue-50 text-blue-700", paid: "bg-green-50 text-green-700", void: "bg-slate-100 text-slate-600" };

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function date(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-CO");
}

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  if (error instanceof Error) return error.message;
  return "No fue posible cargar los reportes.";
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Receipt;
  tone: string;
}) {
  return <article className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="mb-3 flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon size={18} /></span></div><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></article>;
}

export function ReportsScreen({ canAdminister = false }: { canAdminister?: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [companyName, setCompanyName] = useState("Gestor de Servicios");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [clientsResult, invoicesResult, paymentsResult, servicesResult, companyResult] = await Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("invoices").select("id,invoice_number,client_id,issue_date,due_date,status,grand_total,clients(name),payments(amount)").order("issue_date", { ascending: false }).limit(QUERY_LIMITS.report),
        supabase.from("payments").select("invoice_id,payment_date,amount").limit(QUERY_LIMITS.report),
        supabase.from("work_orders").select("id,code,client_id,status,start_date,completion_date,created_at,reported_problem,work_performed,observations,pending_items,clients(name),branches(name),areas(name),assets(name),service_types(name),technicians(name),work_order_items(subtotal)").order("created_at", { ascending: false }).limit(QUERY_LIMITS.report),
        supabase.from("company_settings").select("business_name").eq("id", 1).single(),
      ]);
      if (!active) return;
      const firstError = clientsResult.error || invoicesResult.error || paymentsResult.error || servicesResult.error || companyResult.error;
      if (firstError) setError(messageFrom(firstError));
      if (!clientsResult.error) setClients((clientsResult.data ?? []) as ClientOption[]);
      if (!invoicesResult.error) setInvoices((invoicesResult.data ?? []) as unknown as InvoiceRecord[]);
      if (!paymentsResult.error) setPayments((paymentsResult.data ?? []) as PaymentRecord[]);
      if (!servicesResult.error) setServices((servicesResult.data ?? []) as unknown as ServiceRecord[]);
      if (!companyResult.error && companyResult.data?.business_name) setCompanyName(companyResult.data.business_name);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const report = useMemo(() => {
    const invoiceRows = invoices.filter((invoice) => invoice.issue_date >= from && invoice.issue_date <= to && (!clientId || invoice.client_id === clientId));
    const invoiceIdsForClient = new Set(invoices.filter((invoice) => !clientId || invoice.client_id === clientId).map((invoice) => invoice.id));
    const paymentRows = payments.filter((payment) => payment.payment_date >= from && payment.payment_date <= to && invoiceIdsForClient.has(payment.invoice_id));
    const serviceRows = services.filter((service) => {
      const serviceDate = (service.completion_date || service.created_at).slice(0, 10);
      return serviceDate >= from && serviceDate <= to && (!clientId || service.client_id === clientId) && ["completed", "invoiced"].includes(service.status);
    });
    const billed = invoiceRows.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + Number(invoice.grand_total), 0);
    const collected = paymentRows.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const receivables = invoiceRows.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => {
      const paid = invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0);
      return sum + Math.max(Number(invoice.grand_total) - paid, 0);
    }, 0);

    const clientMap = new Map<string, { id: string; client: string; invoices: number; billed: number; paid: number; balance: number }>();
    invoiceRows.filter((invoice) => invoice.status !== "void").forEach((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const key = invoice.client_id;
      const current = clientMap.get(key) ?? { id: key, client: invoice.clients?.name || "Cliente", invoices: 0, billed: 0, paid: 0, balance: 0 };
      current.invoices += 1;
      current.billed += Number(invoice.grand_total);
      current.paid += paid;
      current.balance += Math.max(Number(invoice.grand_total) - paid, 0);
      clientMap.set(key, current);
    });
    const clientRows = Array.from(clientMap.values()).sort((a, b) => b.billed - a.billed);

    const statusCounts = (["pending", "partial", "paid", "void"] as InvoiceStatus[]).map((status) => ({ status, count: invoiceRows.filter((invoice) => invoice.status === status).length }));
    return { invoiceRows, paymentRows, serviceRows, billed, collected, receivables, clientRows, statusCounts };
  }, [clientId, from, invoices, payments, services, to]);

  const exportData = useMemo<ReportExportData>(() => ({
    companyName, from, to, billed: report.billed, collected: report.collected, receivables: report.receivables, services: report.serviceRows.length,
    invoices: report.invoiceRows.map((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return { number: invoice.invoice_number, client: invoice.clients?.name || "Cliente", issueDate: date(invoice.issue_date), dueDate: date(invoice.due_date), status: invoiceLabels[invoice.status], total: Number(invoice.grand_total), paid, balance: Math.max(Number(invoice.grand_total) - paid, 0) };
    }),
    servicesDetail: report.serviceRows.map((service) => ({ code: service.code, client: service.clients?.name || "Cliente", branch: service.branches?.name || "Sin sede", serviceType: service.service_types?.name || "Servicio", date: date(service.completion_date || service.created_at), status: service.status === "invoiced" ? "Facturada" : "Terminada", total: service.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0) })),
    clients: report.clientRows,
  }), [companyName, from, report, to]);

  const exportFile = async (type: "excel" | "pdf") => {
    setError("");
    setExporting(type);
    try {
      const { exportReportExcel, exportReportPdf } = await import("./reportExports");
      if (type === "excel") await exportReportExcel(exportData); else await exportReportPdf(exportData);
    } catch (exportError) {
      setError(`No fue posible exportar el reporte: ${messageFrom(exportError)}`);
    } finally {
      setExporting(null);
    }
  };

  const exportWorks = () => {
    const rows: WorkReportRow[] = report.serviceRows.map((service) => ({
      code: service.code, client: service.clients?.name || "Cliente", branch: service.branches?.name || "Sin sede", area: service.areas?.name || "Sin área", asset: service.assets?.name || "Sin equipo", serviceType: service.service_types?.name || "Servicio", technician: service.technicians?.name || "Sin técnico", startDate: service.start_date, completionDate: service.completion_date, reportedProblem: service.reported_problem || "", workPerformed: service.work_performed || "", observations: service.observations || "", pendingItems: service.pending_items || "",
    }));
    if (!rows.length) return setError("No hay trabajos terminados para los filtros seleccionados.");
    setError("");
    exportWorkReportPdf(companyName, rows, from, to);
  };

  const maxClientBilling = Math.max(...report.clientRows.slice(0, 5).map((client) => client.billed), 1);
  const totalStatuses = Math.max(report.statusCounts.reduce((sum, item) => sum + item.count, 0), 1);

  return <div>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold sm:text-2xl">Reportes</h1><p className="mt-0.5 text-sm text-muted-foreground">Facturación, recaudo, cartera y servicios realizados</p></div><div className="flex flex-wrap gap-2"><button onClick={exportWorks} disabled={loading} className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 disabled:opacity-60"><Wrench size={16} />PDF trabajos</button><button onClick={() => void exportFile("excel")} disabled={Boolean(exporting)} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 disabled:opacity-60">{exporting === "excel" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}Excel</button><button onClick={() => void exportFile("pdf")} disabled={Boolean(exporting)} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{exporting === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}PDF gestión</button></div></div>

    <section className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"><label className="text-xs font-semibold">Desde<input type="date" className={`${inputClass} mt-1 block`} value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-xs font-semibold">Hasta<input type="date" className={`${inputClass} mt-1 block`} value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><label className="min-w-56 flex-1 text-xs font-semibold">Cliente<select className={`${inputClass} mt-1 block w-full`} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><span className="flex items-center gap-1 pb-2 text-xs text-muted-foreground"><CalendarRange size={14} />Los indicadores cambian con estos filtros</span></section>

    <ToastFeedback error={error} success={success} />
    {loading ? <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div> : <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard label="Facturado" value={money(report.billed)} detail={`${report.invoiceRows.length} factura(s) emitida(s)`} icon={Receipt} tone="bg-blue-50 text-blue-700" /><MetricCard label="Recaudado" value={money(report.collected)} detail={`${report.paymentRows.length} pago(s) recibido(s)`} icon={CircleDollarSign} tone="bg-green-50 text-green-700" /><MetricCard label="Por cobrar" value={money(report.receivables)} detail="Saldo de facturas del período" icon={FileText} tone="bg-red-50 text-red-700" /><MetricCard label="Servicios" value={report.serviceRows.length} detail="Terminados o facturados" icon={Wrench} tone="bg-orange-50 text-orange-700" /></div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><BarChart3 size={17} className="text-[#f97316]" />Clientes con mayor facturación</h2>{report.clientRows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No hay facturación en este período.</p> : <div className="space-y-3">{report.clientRows.slice(0, 5).map((client) => <div key={client.id}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-semibold">{client.client}</span><span className="tabular-nums">{money(client.billed)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#f97316]" style={{ width: `${Math.max(3, (client.billed / maxClientBilling) * 100)}%` }} /></div></div>)}</div>}</section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><h2 className="mb-4 text-sm font-bold">Estado de las facturas</h2><div className="mb-5 flex h-4 overflow-hidden rounded-full bg-muted">{report.statusCounts.map(({ status, count }) => count > 0 && <div key={status} title={`${invoiceLabels[status]}: ${count}`} className={status === "paid" ? "bg-green-500" : status === "partial" ? "bg-blue-500" : status === "pending" ? "bg-amber-500" : "bg-slate-400"} style={{ width: `${(count / totalStatuses) * 100}%` }} />)}</div><div className="grid grid-cols-2 gap-3">{report.statusCounts.map(({ status, count }) => <div key={status} className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm"><span>{invoiceLabels[status]}</span><strong>{count}</strong></div>)}</div></section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-bold">Detalle de facturas</h2></div>{report.invoiceRows.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No hay facturas para los filtros seleccionados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2.5 text-left">Factura</th><th className="px-4 py-2.5 text-left">Cliente</th><th className="px-4 py-2.5 text-left">Emisión</th><th className="px-4 py-2.5 text-left">Estado</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Pagado</th><th className="px-4 py-2.5 text-right">Saldo</th>{canAdminister && <th className="px-4 py-2.5 text-center">Acciones</th>}</tr></thead><tbody className="divide-y divide-border">{report.invoiceRows.map((invoice) => { const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0); const balance = Math.max(Number(invoice.grand_total) - paid, 0); return <tr key={invoice.id}><td className="px-4 py-3 font-mono text-xs font-bold">{invoice.invoice_number}</td><td className="px-4 py-3">{invoice.clients?.name || "Cliente"}</td><td className="px-4 py-3 text-xs">{date(invoice.issue_date)}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${invoiceStyles[invoice.status]}`}>{invoiceLabels[invoice.status]}</span></td><td className="px-4 py-3 text-right tabular-nums">{money(Number(invoice.grand_total))}</td><td className="px-4 py-3 text-right tabular-nums text-green-700">{money(paid)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">{money(balance)}</td>{canAdminister && <td className="px-4 py-3 text-center"><button type="button" disabled={paid > 0} onClick={() => { setDeletingInvoice(invoice); setError(""); setSuccess(""); }} title={paid > 0 ? "Elimina primero los pagos registrados" : "Eliminar factura"} aria-label={`Eliminar factura ${invoice.invoice_number}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={14} /></button></td>}</tr>; })}</tbody></table></div>}</section>
    </>}
    {deletingInvoice && <InvoiceDeleteModal invoice={{ id: deletingInvoice.id, invoice_number: deletingInvoice.invoice_number, clientName: deletingInvoice.clients?.name || "Cliente" }} onCancel={() => setDeletingInvoice(null)} onDeleted={async () => { const invoiceNumber = deletingInvoice.invoice_number; setInvoices((current) => current.filter((invoice) => invoice.id !== deletingInvoice.id)); setDeletingInvoice(null); setSuccess(`Factura ${invoiceNumber} eliminada correctamente.`); }} />}
  </div>;
}
