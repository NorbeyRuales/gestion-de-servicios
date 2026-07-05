import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, Calendar, CheckCircle2, CheckSquare, Clock, CreditCard, FileText, History, Loader2,
  MapPin, Paperclip, Pencil, Plus, ReceiptText, Search, Send, Square,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ToastFeedback } from "../../components/ToastFeedback";
import { QUERY_LIMITS } from "../../lib/queryLimits";
import { InvoiceVoidForm } from "./InvoiceVoidForm";
import { InvoiceDocuments, type InvoiceDocument } from "./InvoiceDocuments";
import { InvoiceEditForm } from "./InvoiceEditForm";
import { createEmptyManualItem, ManualInvoiceItems, type ManualInvoiceItem } from "./ManualInvoiceItems";
import { PaymentAdminForm } from "./PaymentAdminForm";
import { PaymentProofControl } from "./PaymentProofControl";
import { createPaymentProof, validatePaymentProof, type PaymentProof } from "./paymentProofs";

type InvoiceStatus = "pending" | "partial" | "paid" | "void";
type PaymentMethod = "cash" | "bank_transfer" | "nequi" | "bancolombia" | "daviplata" | "other";
type Tab = "new" | "history";
type InvoiceMode = "orders" | "manual";

interface ClientOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
  client_id?: string;
}

interface PaymentRecord {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  received_at_branch_id: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  proofs: PaymentProof[];
}

interface AuditLogRecord {
  id: string;
  entity_type: "invoice" | "payment";
  entity_id: string;
  action: "insert" | "update" | "delete";
  changes: { reason?: string };
  performed_by: string | null;
  created_at: string;
}

interface ProfileOption { id: string; full_name: string }

interface WorkOrderItemTotal {
  item_type: "material" | "spare_part" | "labor" | "transport" | "rental" | "other";
  subtotal: number;
}

interface BillableOrder {
  id: string;
  code: string;
  client_id: string;
  execution_branch_id: string;
  scheduled_date: string | null;
  completion_date: string | null;
  created_at: string;
  reported_problem: string | null;
  work_performed: string | null;
  branches: BranchOption | null;
  service_types: BranchOption | null;
  work_order_items: WorkOrderItemTotal[];
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client_id: string;
  billing_branch_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  materials_total: number;
  spare_parts_total: number;
  labor_total: number;
  transport_total: number;
  other_total: number;
  discount_total: number;
  grand_total: number;
  notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  updated_at: string;
  clients: ClientOption | null;
  branches: BranchOption | null;
  payments: PaymentRecord[];
  documents: InvoiceDocument[];
  invoice_line_items: { id: string }[];
  invoice_work_orders: { work_orders: { code: string } | null }[];
}

interface InvoiceBaseRecord {
  id: string;
  invoice_number: string;
  client_id: string;
  billing_branch_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  materials_total: number;
  spare_parts_total: number;
  labor_total: number;
  transport_total: number;
  other_total: number;
  discount_total: number;
  grand_total: number;
  notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  updated_at: string;
  invoice_line_items: { id: string }[];
}

interface InvoiceOrderLink {
  invoice_id: string;
  work_order_id: string;
}

interface WorkOrderCode {
  id: string;
  code: string;
}

const inputClass = "w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const statusLabels: Record<InvoiceStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
  void: "Anulada",
};
const statusStyles: Record<InvoiceStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  partial: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
  void: "bg-slate-100 text-slate-600",
};
const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia bancaria",
  nequi: "Nequi",
  bancolombia: "Bancolombia",
  daviplata: "Daviplata",
  other: "Otro",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function localDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-CO") : "Sin fecha";
}

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

  if (message.includes("Solo se pueden facturar órdenes terminadas")) return "Solo se pueden facturar órdenes terminadas.";
  if (message.includes("La orden y la factura deben pertenecer al mismo cliente")) return "Todas las órdenes deben pertenecer al cliente seleccionado.";
  if (message.includes("No tienes permiso")) return "Tu usuario no tiene permiso de facturación.";
  if (message.includes("duplicate key")) return "Una de las órdenes seleccionadas ya fue facturada.";
  if (message.includes("El pago supera el saldo pendiente")) return "El valor supera el saldo pendiente de la factura.";
  if (message.includes("factura anulada")) return "No se pueden registrar pagos en una factura anulada.";
  if (message.includes("sede que recibe el pago")) return "La sede seleccionada no pertenece al cliente de la factura.";
  if (message.includes("Elimina primero los pagos")) return "Elimina primero todos los pagos registrados antes de anular la factura.";
  if (message.includes("Solo un administrador")) return "Esta operación requiere permisos de administrador.";
  return message.replace(/^.*?: /, "") || "No fue posible completar la operación.";
}

function orderTotal(order: BillableOrder) {
  return order.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0);
}

function totalsByType(orders: BillableOrder[]) {
  return orders.flatMap((order) => order.work_order_items).reduce((totals, item) => {
    if (item.item_type === "material") totals.materials += Number(item.subtotal);
    else if (item.item_type === "spare_part") totals.spareParts += Number(item.subtotal);
    else if (item.item_type === "labor") totals.labor += Number(item.subtotal);
    else if (item.item_type === "transport") totals.transport += Number(item.subtotal);
    else totals.other += Number(item.subtotal);
    return totals;
  }, { materials: 0, spareParts: 0, labor: 0, transport: 0, other: 0 });
}

function totalsByManualItems(items: ManualInvoiceItem[]) {
  return items.reduce((totals, item) => {
    const value = Number(item.quantity || 0) * Number(item.unit_price || 0);
    if (item.item_type === "material") totals.materials += value;
    else if (item.item_type === "spare_part") totals.spareParts += value;
    else if (item.item_type === "labor") totals.labor += value;
    else if (item.item_type === "transport") totals.transport += value;
    else totals.other += value;
    return totals;
  }, { materials: 0, spareParts: 0, labor: 0, transport: 0, other: 0 });
}

function Feedback({ error, success }: { error: string; success: string }) {
  return <ToastFeedback error={error} success={success} />;
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-start justify-between gap-4">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>;
}

function PaymentForm({ invoice, balance, branches, onSaved, onCancel }: {
  invoice: InvoiceRecord;
  balance: number;
  branches: BranchOption[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [branchId, setBranchId] = useState(invoice.billing_branch_id ?? "");
  const [reference, setReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentError("");
    if (!paymentDate) return setPaymentError("Selecciona la fecha del pago.");
    if (!Number.isFinite(amount) || amount <= 0) return setPaymentError("El valor del pago debe ser mayor que cero.");
    if (amount > balance) return setPaymentError("El valor supera el saldo pendiente de la factura.");

    if (proofFile) {
      try { validatePaymentProof(proofFile); } catch (fileError) { return setPaymentError(messageFrom(fileError)); }
    }

    setPaymentSaving(true);
    const paymentId = crypto.randomUUID();
    const { error: insertError } = await supabase.from("payments").insert({
      id: paymentId,
      invoice_id: invoice.id,
      payment_date: paymentDate,
      amount,
      payment_method: method,
      received_at_branch_id: branchId || null,
      reference: reference.trim() || null,
      notes: paymentNotes.trim() || null,
    });
    if (insertError) {
      setPaymentError(messageFrom(insertError));
      setPaymentSaving(false);
      return;
    }
    if (proofFile) {
      try {
        await createPaymentProof(invoice.id, paymentId, proofFile);
      } catch (proofError) {
        await supabase.from("payments").delete().eq("id", paymentId);
        setPaymentError(`No se guardó el pago porque falló el comprobante: ${messageFrom(proofError)}`);
        setPaymentSaving(false);
        return;
      }
    }
    await onSaved();
    setPaymentSaving(false);
  };

  return <form onSubmit={(event) => void savePayment(event)} className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h4 className="font-semibold text-sm">Registrar pago</h4><p className="text-xs text-muted-foreground">Saldo disponible: {formatMoney(balance)}</p></div>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
    </div>
    {paymentError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">{paymentError}</div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label className="text-xs font-semibold">Fecha<input type="date" className={`${inputClass} mt-1`} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
      <label className="text-xs font-semibold">Valor recibido<input type="number" min="1" max={balance} step="1" inputMode="numeric" placeholder="$ 0" className={`${inputClass} mt-1`} value={amount || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      <label className="text-xs font-semibold">Método<select className={`${inputClass} mt-1`} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs font-semibold">Sede donde se recibió<select className={`${inputClass} mt-1`} value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Sin sede específica</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Referencia<input className={`${inputClass} mt-1`} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Número de transferencia…" /></label>
      <label className="text-xs font-semibold">Observación<input className={`${inputClass} mt-1`} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Nota opcional…" /></label>
      <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Comprobante opcional
        <span className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-3 py-3 font-normal text-muted-foreground hover:border-orange-300"><Paperclip size={16} />{proofFile?.name || "Adjuntar imagen o PDF (máximo 10 MB)"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} />
      </label>
    </div>
    <div className="mt-3 flex justify-end"><button type="submit" disabled={paymentSaving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{paymentSaving ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}Guardar pago</button></div>
  </form>;
}

export function InvoicesScreen({ canAdminister = false }: { canAdminister?: boolean }) {
  const [tab, setTab] = useState<Tab>("history");
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
  const [orders, setOrders] = useState<BillableOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clientId, setClientId] = useState("");
  const [billingBranchId, setBillingBranchId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [manualItems, setManualItems] = useState<ManualInvoiceItem[]>([createEmptyManualItem()]);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdInvoice, setCreatedInvoice] = useState<{ id: string; invoice_number: string; manual: boolean } | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [pdfInvoiceId, setPdfInvoiceId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [auditInvoiceId, setAuditInvoiceId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [clientsResult, branchesResult, ordersResult, invoicesResult, paymentsResult, proofsResult, documentsResult, invoiceOrdersResult, orderCodesResult, auditResult, profilesResult] = await Promise.all([
      supabase.from("clients").select("id,name").eq("is_active", true).order("name"),
      supabase.from("branches").select("id,name,client_id").order("name"),
      supabase.from("work_orders").select("id,code,client_id,execution_branch_id,scheduled_date,completion_date,created_at,reported_problem,work_performed,branches(id,name),service_types(id,name),work_order_items(item_type,subtotal)").eq("status", "completed").order("completion_date", { ascending: false, nullsFirst: false }).limit(QUERY_LIMITS.list),
      supabase.from("invoices").select("id,invoice_number,client_id,billing_branch_id,issue_date,due_date,status,materials_total,spare_parts_total,labor_total,transport_total,other_total,discount_total,grand_total,notes,void_reason,voided_at,created_at,updated_at,invoice_line_items(id)").order("created_at", { ascending: false }).limit(QUERY_LIMITS.list),
      supabase.from("payments").select("id,invoice_id,payment_date,amount,payment_method,received_at_branch_id,reference,notes,created_at").order("payment_date", { ascending: false }).order("created_at", { ascending: false }).limit(QUERY_LIMITS.report),
      supabase.from("payment_proofs").select("id,payment_id,file_path,created_at").limit(QUERY_LIMITS.report),
      supabase.from("invoice_documents").select("id,invoice_id,version,file_path,invoice_status,grand_total,paid_total,balance_total,generated_by,created_at").order("version", { ascending: false }).limit(QUERY_LIMITS.report),
      supabase.from("invoice_work_orders").select("invoice_id,work_order_id").limit(QUERY_LIMITS.report),
      supabase.from("work_orders").select("id,code").limit(QUERY_LIMITS.lookup),
      canAdminister ? supabase.from("audit_logs").select("id,entity_type,entity_id,action,changes,performed_by,created_at").order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
      canAdminister ? supabase.from("profiles").select("id,full_name") : Promise.resolve({ data: [], error: null }),
    ]);

    if (invoicesResult.error) {
      setError(`No fue posible cargar el historial de facturas: ${messageFrom(invoicesResult.error)}`);
    } else {
      const nextClients = (clientsResult.data ?? []) as ClientOption[];
      const allBranches = (branchesResult.data ?? []) as BranchOption[];
      const invoicePayments = (paymentsResult.data ?? []) as PaymentRecord[];
      const paymentProofs = (proofsResult.data ?? []) as PaymentProof[];
      const invoiceDocuments = (documentsResult.data ?? []) as InvoiceDocument[];
      const invoiceOrders = (invoiceOrdersResult.data ?? []) as InvoiceOrderLink[];
      const orderCodes = (orderCodesResult.data ?? []) as WorkOrderCode[];
      setClients(nextClients);
      setAllBranches(allBranches);
      setOrders((ordersResult.data ?? []) as unknown as BillableOrder[]);
      setAuditLogs((auditResult.data ?? []) as AuditLogRecord[]);
      setProfiles((profilesResult.data ?? []) as ProfileOption[]);
      setInvoices(((invoicesResult.data ?? []) as InvoiceBaseRecord[]).map((invoice) => ({
        ...invoice,
        clients: nextClients.find((client) => client.id === invoice.client_id) ?? null,
        branches: allBranches.find((branch) => branch.id === invoice.billing_branch_id) ?? null,
        payments: invoicePayments.filter((payment) => payment.invoice_id === invoice.id).map((payment) => ({
          ...payment,
          proofs: paymentProofs.filter((proof) => proof.payment_id === payment.id),
        })),
        documents: invoiceDocuments.filter((document) => document.invoice_id === invoice.id),
        invoice_work_orders: invoiceOrders
          .filter((item) => item.invoice_id === invoice.id)
          .map((item) => ({ work_orders: orderCodes.find((order) => order.id === item.work_order_id) ?? null })),
      })));
      if (!clientId && nextClients[0]) setClientId(nextClients[0].id);

      const auxiliaryError = clientsResult.error || branchesResult.error || ordersResult.error || paymentsResult.error || proofsResult.error || documentsResult.error || invoiceOrdersResult.error || orderCodesResult.error || auditResult.error || profilesResult.error;
      if (auxiliaryError) setError(`Las facturas se cargaron, pero faltan algunos datos relacionados: ${messageFrom(auxiliaryError)}`);
    }
    setLoading(false);
  }, [canAdminister, clientId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!clientId) {
      setBranches([]);
      setBillingBranchId("");
      setSelected(new Set());
      return;
    }

    setSelected(new Set());
    void supabase.from("branches").select("id,name").eq("client_id", clientId).eq("is_active", true).order("name").then(({ data, error: queryError }) => {
      if (queryError) setError(messageFrom(queryError));
      const nextBranches = (data ?? []) as BranchOption[];
      setBranches(nextBranches);
      setBillingBranchId((current) => current && nextBranches.some((branch) => branch.id === current) ? current : nextBranches[0]?.id ?? "");
    });
  }, [clientId]);

  const billableOrders = useMemo(() => orders.filter((order) => order.client_id === clientId), [orders, clientId]);
  const selectedOrders = useMemo(() => billableOrders.filter((order) => selected.has(order.id)), [billableOrders, selected]);
  const selectedTotals = totalsByType(selectedOrders);
  const manualTotals = totalsByManualItems(manualItems);
  const activeTotals = invoiceMode === "manual" ? manualTotals : selectedTotals;
  const subtotal = activeTotals.materials + activeTotals.spareParts + activeTotals.labor + activeTotals.transport + activeTotals.other;
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const term = search.toLowerCase();
    const matchesSearch = [invoice.invoice_number, invoice.clients?.name, invoice.branches?.name, invoice.notes].some((value) => value?.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  }), [invoices, search, statusFilter]);

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected((current) => current.size === billableOrders.length ? new Set() : new Set(billableOrders.map((order) => order.id)));

  const archivePdf = async (invoice: InvoiceRecord) => {
    setError("");
    setSuccess("");
    setPdfInvoiceId(invoice.id);
    try {
      const { generateInvoicePdf, savePdfBlob } = await import("./invoicePdf");
      const generated = await generateInvoicePdf(invoice.id);
      const safeNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_");
      const filePath = `${invoice.id}/${Date.now()}-${safeNumber}.pdf`;
      const { error: uploadError } = await supabase.storage.from("invoices").upload(filePath, generated.blob, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: registerData, error: registerError } = await supabase.rpc("register_invoice_document", {
        p_invoice_id: invoice.id,
        p_file_path: filePath,
        p_invoice_status: generated.status,
        p_grand_total: generated.grandTotal,
        p_paid_total: generated.paidTotal,
        p_balance_total: generated.balanceTotal,
      });

      let registered = (Array.isArray(registerData) ? registerData[0] : registerData) as InvoiceDocument | null;
      if (registerError || !registered) {
        const { data: existing } = await supabase.from("invoice_documents").select("id,invoice_id,version,file_path,invoice_status,grand_total,paid_total,balance_total,generated_by,created_at").eq("file_path", filePath).maybeSingle();
        registered = existing as InvoiceDocument | null;
        if (!registered) {
          await supabase.storage.from("invoices").remove([filePath]);
          throw registerError ?? new Error("No se pudo registrar la copia permanente del PDF.");
        }
      }

      const versionedName = generated.fileName.replace(/\.pdf$/i, `-v${registered.version}.pdf`);
      savePdfBlob(generated.blob, versionedName);
      await load();
      setSuccess(`Factura ${invoice.invoice_number}, versión ${registered.version}, archivada y descargada correctamente.`);
    } catch (pdfError) {
      setError(`No fue posible generar y archivar el PDF: ${messageFrom(pdfError)}`);
    } finally {
      setPdfInvoiceId(null);
    }
  };

  const save = async () => {
    setError("");
    setSuccess("");
    if (!invoiceMode) return setError("Elige si vas a facturar órdenes o crear una factura manual.");
    if (!clientId) return setError("Selecciona un cliente.");
    if (invoiceMode === "orders" && selected.size === 0) return setError("Selecciona al menos una orden terminada.");
    if (invoiceMode === "manual" && manualItems.some((item) => item.description.trim().length < 2 || Number(item.quantity) <= 0 || Number(item.unit_price) < 0)) return setError("Completa correctamente todos los conceptos manuales.");
    if (discount < 0) return setError("El descuento no puede ser negativo.");
    if (dueDate && dueDate < issueDate) return setError("La fecha de vencimiento no puede ser anterior a la emisión.");

    setSaving(true);
    try {
      if (invoiceMode === "manual") {
        const { data, error: saveError } = await supabase.rpc("create_manual_invoice", {
          payload: {
            client_id: clientId,
            billing_branch_id: billingBranchId || null,
            issue_date: issueDate,
            due_date: dueDate || null,
            discount_total: Number(discount || 0),
            notes,
            items: manualItems.map(({ item_type, description, quantity, unit_price }) => ({ item_type, description: description.trim(), quantity: Number(quantity), unit_price: Number(unit_price) })),
          },
        });
        if (saveError) throw saveError;
        const created = (Array.isArray(data) ? data[0] : data) as { id: string; invoice_number: string } | null;
        if (!created?.id || !created.invoice_number) throw new Error("No se recibió la factura manual creada.");
        setManualItems([createEmptyManualItem()]);
        setDiscount(0); setNotes(""); setDueDate(""); setSearch(""); setStatusFilter("all");
        setCreatedInvoice({ ...created, manual: true });
        setSuccess(`Factura manual ${created.invoice_number} creada correctamente.`);
        setTab("history");
        await load();
        return;
      }

      const selectedOrderIds = Array.from(selected);
      const { error: saveError } = await supabase.rpc("create_invoice_from_orders_v2", {
        payload: {
          client_id: clientId,
          billing_branch_id: billingBranchId || null,
          issue_date: issueDate,
          due_date: dueDate || null,
          discount_total: Number(discount || 0),
          notes,
          work_order_ids: selectedOrderIds,
        },
      });
      if (saveError) return setError(messageFrom(saveError));

      // La respuesta del RPC no se usa: algunas sesiones conservan el contrato
      // anterior y reciben un UUID. La tabla es la fuente de verdad.
      const { data: invoiceLink, error: linkError } = await supabase
        .from("invoice_work_orders")
        .select("invoice_id")
        .eq("work_order_id", selectedOrderIds[0])
        .single();
      if (linkError || !invoiceLink?.invoice_id) throw linkError ?? new Error("No se encontró la factura creada.");

      const { data: invoiceData, error: invoiceLookupError } = await supabase
        .from("invoices")
        .select("id,invoice_number")
        .eq("id", invoiceLink.invoice_id)
        .single();
      if (invoiceLookupError || !invoiceData) throw invoiceLookupError ?? new Error("No se encontró el número de la factura creada.");
      const createdInvoiceResult = invoiceData as { id: string; invoice_number: string };

      setSelected(new Set());
      setDiscount(0);
      setNotes("");
      setDueDate("");
      setSearch("");
      setStatusFilter("all");
      setCreatedInvoice({ ...createdInvoiceResult, manual: false });
      setSuccess(`Factura ${createdInvoiceResult.invoice_number} creada correctamente. Las órdenes seleccionadas pasaron a Facturado.`);
      setTab("history");
      await load();
    } catch (saveException) {
      setError(messageFrom(saveException));
    } finally {
      setSaving(false);
    }
  };

  return <div>
    <PageTitle title="Facturas y cobros" subtitle="Factura órdenes terminadas o registra cobros manuales" action={<button onClick={() => { setTab("new"); setInvoiceMode(null); setError(""); setSuccess(""); }} className="flex items-center gap-2 bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus size={16} />Nueva factura</button>} />
    <Feedback error={error} success={success} />

    <div className="mb-5 flex gap-1 border-b border-border">
      {([["new", "Nueva factura"], ["history", "Historial"]] as const).map(([value, label]) => <button key={value} onClick={() => { setTab(value); if (value === "new") setInvoiceMode(null); }} className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === value ? "border-[#f97316] text-[#f97316]" : "border-transparent text-muted-foreground"}`}>{label}</button>)}
    </div>

    {loading ? <div className="py-20 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : tab === "new" ? <div className="space-y-5 max-w-5xl">
      <section className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setInvoiceMode("orders")} className={`rounded-xl border p-4 text-left ${invoiceMode === "orders" ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100" : "border-border bg-card"}`}><strong className="block text-sm">Desde órdenes terminadas</strong><span className="mt-1 block text-xs text-muted-foreground">Selecciona trabajos registrados previamente en la aplicación.</span></button>
        <button type="button" onClick={() => setInvoiceMode("manual")} className={`rounded-xl border p-4 text-left ${invoiceMode === "manual" ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100" : "border-border bg-card"}`}><strong className="block text-sm">Factura manual</strong><span className="mt-1 block text-xs text-muted-foreground">Agrega directamente los trabajos y conceptos realizados durante la semana.</span></button>
      </section>
      {!invoiceMode && <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center"><FileText className="mx-auto text-muted-foreground" /><h2 className="mt-3 font-semibold">Elige cómo crear la factura</h2><p className="mt-1 text-sm text-muted-foreground">Al seleccionar una opción aparecerán únicamente los campos correspondientes.</p></div>}
      {invoiceMode && <>
      <section className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h2 className="font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-[#f97316]" />Datos de la factura</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm font-semibold">Cliente
            <select className={`${inputClass} mt-1.5`} value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Selecciona…</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Sede de cobro
            <select className={`${inputClass} mt-1.5`} value={billingBranchId} onChange={(event) => setBillingBranchId(event.target.value)}>
              <option value="">Sin sede específica</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Fecha emisión
            <input type="date" className={`${inputClass} mt-1.5`} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">Fecha vencimiento
            <input type="date" className={`${inputClass} mt-1.5`} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>
      </section>

      {invoiceMode === "orders" ? <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold">Órdenes terminadas pendientes de facturar</h2>
            <p className="text-sm text-muted-foreground">{billableOrders.length} disponible{billableOrders.length === 1 ? "" : "s"}</p>
          </div>
          {billableOrders.length > 0 && <button onClick={toggleAll} className="text-sm font-semibold text-[#f97316]">{selected.size === billableOrders.length ? "Deseleccionar" : "Seleccionar todas"}</button>}
        </div>

        {billableOrders.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No hay órdenes terminadas pendientes de facturar para este cliente.</div> : <div className="divide-y divide-border">
          {billableOrders.map((order) => {
            const isSelected = selected.has(order.id);
            return <button key={order.id} onClick={() => toggle(order.id)} className={`w-full text-left p-4 transition-colors ${isSelected ? "bg-orange-50/70" : "hover:bg-muted/30"}`}>
              <div className="flex items-start gap-3">
                <div className="pt-1">{isSelected ? <CheckSquare size={18} className="text-[#f97316]" /> : <Square size={18} className="text-muted-foreground" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm">{order.reported_problem || order.work_performed || "Orden sin descripción"}</h3>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{order.code}</p>
                    </div>
                    <strong className="text-sm font-semibold tabular-nums">{formatMoney(orderTotal(order))}</strong>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin size={11} />{order.branches?.name || "Sin sede"}</span>
                    <span>{order.service_types?.name || "Servicio"}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{localDate(order.completion_date?.slice(0, 10) || order.scheduled_date || order.created_at.slice(0, 10))}</span>
                  </div>
                </div>
              </div>
            </button>;
          })}
        </div>}
      </section> : <ManualInvoiceItems items={manualItems} onChange={setManualItems} />}

      {(invoiceMode === "manual" || selectedOrders.length > 0) && <section className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h2 className="font-bold mb-4">Resumen</h2>
        <div className="grid md:grid-cols-[1fr_320px] gap-5">
          <label className="text-sm font-semibold">Notas
            <textarea rows={5} className={`${inputClass} mt-1.5`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones que quieras dejar en la factura…" />
          </label>
          <div className="space-y-3">
            <label className="text-sm font-semibold block">Descuento
              <input type="number" min="0" inputMode="numeric" placeholder="$ 0" className={`${inputClass} mt-1.5`} value={discount || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDiscount(Number(event.target.value))} />
            </label>
            <div className="rounded-xl bg-[#1a3558] text-white p-4 space-y-2 text-sm">
              <p className="flex justify-between"><span>Materiales</span><strong>{formatMoney(activeTotals.materials)}</strong></p>
              <p className="flex justify-between"><span>Repuestos</span><strong>{formatMoney(activeTotals.spareParts)}</strong></p>
              <p className="flex justify-between"><span>Mano de obra</span><strong>{formatMoney(activeTotals.labor)}</strong></p>
              <p className="flex justify-between"><span>Transporte</span><strong>{formatMoney(activeTotals.transport)}</strong></p>
              <p className="flex justify-between"><span>Otros</span><strong>{formatMoney(activeTotals.other)}</strong></p>
              {discount > 0 && <p className="flex justify-between text-orange-200"><span>Descuento</span><strong>-{formatMoney(discount)}</strong></p>}
              <p className="flex justify-between border-t border-white/20 pt-2 text-base"><span>Total</span><strong>{formatMoney(total)}</strong></p>
            </div>
            <button disabled={saving} onClick={() => void save()} className="w-full rounded-lg bg-[#f97316] px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {invoiceMode === "manual" ? "Crear factura manual" : "Crear factura"}
            </button>
          </div>
        </div>
      </section>}
      </>}
    </div> : <div className="max-w-5xl">
      {createdInvoice && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Factura creada y registrada en el historial</p>
            <p className="mt-0.5">Número: <span className="font-mono font-bold">{createdInvoice.invoice_number}</span>. {createdInvoice.manual ? "Los conceptos manuales quedaron guardados en el detalle de la factura." : <>Las órdenes seleccionadas ya no aparecen como pendientes de facturar porque quedaron en estado <strong>Facturado</strong>.</>}</p>
          </div>
        </div>
      </div>}
      <div className="grid sm:grid-cols-[1fr_190px_auto] gap-3 mb-4">
        <div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por número, cliente o sede…" /></div>
        <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | "all")}><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button onClick={() => void load()} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold">Actualizar ({invoices.length})</button>
      </div>

      {filteredInvoices.length === 0 ? <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center text-sm text-muted-foreground">No hay facturas para mostrar.</div> : <div className="space-y-3">{filteredInvoices.map((invoice) => {
        const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const balance = Math.max(Number(invoice.grand_total) - paid, 0);
        const paidPct = Number(invoice.grand_total) > 0 ? Math.min(100, Math.round((paid / Number(invoice.grand_total)) * 100)) : 0;
        const isCreated = createdInvoice?.id === invoice.id;
        const isRegisteringPayment = paymentInvoiceId === invoice.id;
        const invoiceBranches = allBranches.filter((branch) => branch.client_id === invoice.client_id);
        const relatedEntityIds = new Set([invoice.id, ...invoice.payments.map((payment) => payment.id)]);
        const invoiceAudit = auditLogs.filter((log) => relatedEntityIds.has(log.entity_id));
        const latestDocument = invoice.documents[0];
        const isDocumentStale = !latestDocument
          || new Date(invoice.updated_at).getTime() > new Date(latestDocument.created_at).getTime()
          || latestDocument.invoice_status !== invoice.status
          || Math.round(Number(latestDocument.grand_total) * 100) !== Math.round(Number(invoice.grand_total) * 100)
          || Math.round(Number(latestDocument.paid_total) * 100) !== Math.round(paid * 100)
          || Math.round(Number(latestDocument.balance_total) * 100) !== Math.round(balance * 100);
        return <article key={invoice.id} className={`bg-card rounded-xl border p-4 shadow-sm ${isCreated ? "border-green-300 ring-2 ring-green-100" : "border-border"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-mono font-bold">{invoice.invoice_number}</h3><span className={`text-xs px-2 py-1 rounded ${statusStyles[invoice.status]}`}>{statusLabels[invoice.status]}</span>{isCreated && <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Recién creada</span>}</div>
              <p className="text-sm text-muted-foreground mt-1">{invoice.clients?.name || "Cliente"}</p>
              <p className="text-xs text-muted-foreground mt-1">{invoice.invoice_work_orders.map((item) => item.work_orders?.code).filter(Boolean).join(", ") || (invoice.invoice_line_items.length > 0 ? "Factura manual" : "Sin órdenes")}</p>
            </div>
            <div className="text-right">
              <strong className="text-lg font-semibold tabular-nums">{formatMoney(Number(invoice.grand_total))}</strong>
              {balance > 0 && <p className="text-xs font-semibold text-red-600">Saldo: {formatMoney(balance)}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar size={11} />Emisión: {localDate(invoice.issue_date)}</span>
            <span className="flex items-center gap-1"><Clock size={11} />Vence: {localDate(invoice.due_date)}</span>
            <span className="flex items-center gap-1"><MapPin size={11} />Cobro: {invoice.branches?.name || "Sin sede"}</span>
          </div>
          {invoice.status === "void" && invoice.void_reason && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><strong>Motivo de anulación:</strong> {invoice.void_reason}{invoice.voided_at && <span> · {new Date(invoice.voided_at).toLocaleString("es-CO")}</span>}</div>}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Pagado {paidPct}%</span><span>{formatMoney(paid)} / {formatMoney(Number(invoice.grand_total))}</span></div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#f97316]" style={{ width: `${paidPct}%` }} /></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ReceiptText size={14} /><span>{invoice.payments.length} pago{invoice.payments.length === 1 ? "" : "s"} registrado{invoice.payments.length === 1 ? "" : "s"}</span></div>
            <div className="flex flex-wrap gap-2">
              {canAdminister && invoice.payments.length === 0 && invoice.status !== "void" && <button onClick={() => setEditingInvoiceId(editingInvoiceId === invoice.id ? null : invoice.id)} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"><Pencil size={14} />Editar factura</button>}
              {canAdminister && <button onClick={() => setAuditInvoiceId(auditInvoiceId === invoice.id ? null : invoice.id)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"><History size={14} />Auditoría</button>}
              {canAdminister && invoice.status !== "void" && <button disabled={paid > 0} title={paid > 0 ? "Elimina primero los pagos registrados" : "Anular factura"} onClick={() => setVoidingInvoiceId(voidingInvoiceId === invoice.id ? null : invoice.id)} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Ban size={14} />Anular</button>}
              {balance > 0 && invoice.status !== "void" && <button onClick={() => setPaymentInvoiceId(isRegisteringPayment ? null : invoice.id)} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-3 py-2 text-xs font-semibold text-white"><CreditCard size={14} />Registrar pago</button>}
            </div>
          </div>

          {editingInvoiceId === invoice.id && <InvoiceEditForm invoice={invoice} branches={invoiceBranches} onCancel={() => setEditingInvoiceId(null)} onSaved={async () => { setEditingInvoiceId(null); setSuccess(`Factura ${invoice.invoice_number} actualizada. Regenera el PDF si ya existía una copia.`); await load(); }} />}

          <InvoiceDocuments
            invoiceNumber={invoice.invoice_number}
            documents={invoice.documents}
            isStale={isDocumentStale}
            generating={pdfInvoiceId === invoice.id}
            onGenerate={() => archivePdf(invoice)}
            onError={(documentError) => { setSuccess(""); setError(documentError); }}
          />

          {invoice.payments.length > 0 && <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <div className="divide-y divide-border">{invoice.payments.map((payment) => {
              const receivingBranch = allBranches.find((branch) => branch.id === payment.received_at_branch_id);
              const isEditing = editingPaymentId === payment.id;
              return <div key={payment.id} className="px-3 py-2.5 text-xs"><div className="grid gap-1 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                <span className="text-muted-foreground">{localDate(payment.payment_date)}</span>
                <div><span className="font-semibold">{paymentMethodLabels[payment.payment_method]}</span>{receivingBranch && <span className="text-muted-foreground"> · {receivingBranch.name}</span>}{payment.reference && <p className="text-muted-foreground">Ref: {payment.reference}</p>}{payment.notes && <p className="text-muted-foreground">{payment.notes}</p>}<PaymentProofControl
                  invoiceId={invoice.id}
                  paymentId={payment.id}
                  proofs={payment.proofs}
                  onError={(proofError) => { setSuccess(""); setError(proofError); }}
                  onChanged={async () => {
                    setError("");
                    setSuccess("Comprobante de pago actualizado correctamente.");
                    await load();
                  }}
                /></div>
                <div className="flex items-center justify-end gap-2"><strong className="font-semibold tabular-nums text-green-700">+{formatMoney(Number(payment.amount))}</strong>{canAdminister && <button type="button" title="Corregir pago" onClick={() => setEditingPaymentId(isEditing ? null : payment.id)} className="grid h-7 w-7 place-items-center rounded border border-border bg-card text-blue-700"><Pencil size={13} /></button>}</div>
              </div>{isEditing && <PaymentAdminForm payment={payment} maxAmount={balance + Number(payment.amount)} branches={invoiceBranches} onCancel={() => setEditingPaymentId(null)} onSaved={async (adminMessage) => { setEditingPaymentId(null); setError(""); setSuccess(adminMessage); await load(); }} />}
              </div>;
            })}</div>
          </div>}

          {voidingInvoiceId === invoice.id && <InvoiceVoidForm invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} onCancel={() => setVoidingInvoiceId(null)} onVoided={async () => { setVoidingInvoiceId(null); setError(""); setSuccess(`Factura ${invoice.invoice_number} anulada. Sus órdenes volvieron a estar disponibles.`); await load(); }} />}

          {canAdminister && auditInvoiceId === invoice.id && <section className="mt-4 rounded-xl border border-border bg-muted/20 p-3"><h4 className="mb-2 text-sm font-bold">Historial administrativo</h4>{invoiceAudit.length === 0 ? <p className="text-xs text-muted-foreground">No hay eventos de auditoría para este registro.</p> : <div className="space-y-2">{invoiceAudit.slice(0, 20).map((log) => { const actor = profiles.find((profile) => profile.id === log.performed_by)?.full_name || "Sistema"; const action = log.action === "insert" ? "Creación" : log.action === "delete" ? "Eliminación" : "Actualización"; return <div key={log.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-card px-3 py-2 text-xs"><div><strong>{action} de {log.entity_type === "invoice" ? "factura" : "pago"}</strong>{log.changes?.reason && <p className="mt-0.5 text-muted-foreground">Motivo: {log.changes.reason}</p>}<p className="text-muted-foreground">Por: {actor}</p></div><time className="text-muted-foreground">{new Date(log.created_at).toLocaleString("es-CO")}</time></div>; })}</div>}</section>}

          {isRegisteringPayment && <PaymentForm
            invoice={invoice}
            balance={balance}
            branches={invoiceBranches}
            onCancel={() => setPaymentInvoiceId(null)}
            onSaved={async () => {
              setPaymentInvoiceId(null);
              setSuccess(`Pago registrado correctamente en la factura ${invoice.invoice_number}.`);
              await load();
            }}
          />}
        </article>;
      })}</div>}
    </div>}
  </div>;
}
