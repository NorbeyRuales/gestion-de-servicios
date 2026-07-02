import { useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface BranchOption { id: string; name: string }

interface EditableInvoice {
  id: string;
  issue_date: string;
  due_date: string | null;
  billing_branch_id: string | null;
  discount_total: number;
  notes: string | null;
  materials_total: number;
  spare_parts_total: number;
  labor_total: number;
  transport_total: number;
  other_total: number;
}

interface InvoiceEditFormProps {
  invoice: EditableInvoice;
  branches: BranchOption[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message.replace(/^.*?: /, "");
  return "No fue posible actualizar la factura.";
}

export function InvoiceEditForm({ invoice, branches, onCancel, onSaved }: InvoiceEditFormProps) {
  const [issueDate, setIssueDate] = useState(invoice.issue_date);
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const [branchId, setBranchId] = useState(invoice.billing_branch_id ?? "");
  const [discount, setDiscount] = useState(Number(invoice.discount_total));
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal = Number(invoice.materials_total) + Number(invoice.spare_parts_total) + Number(invoice.labor_total) + Number(invoice.transport_total) + Number(invoice.other_total);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!issueDate) return setError("Selecciona la fecha de emisión.");
    if (dueDate && dueDate < issueDate) return setError("La fecha de vencimiento no puede ser anterior a la emisión.");
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) return setError("El descuento debe estar entre cero y el subtotal.");
    setSaving(true);
    const { error: updateError } = await supabase.rpc("update_invoice_before_payment", {
      p_invoice_id: invoice.id,
      payload: { issue_date: issueDate, due_date: dueDate || null, billing_branch_id: branchId || null, discount_total: discount, notes },
    });
    if (updateError) setError(messageFrom(updateError)); else await onSaved();
    setSaving(false);
  };

  return <form onSubmit={(event) => void save(event)} className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold">Editar factura antes del primer pago</h4><p className="text-xs text-muted-foreground">Las órdenes y sus costos no cambian; puedes ajustar datos de cobro, fechas, descuento y notas.</p></div><button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground">Cancelar</button></div>
    {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"><AlertCircle size={14} />{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-semibold">Fecha de emisión<input type="date" className={inputClass} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
      <label className="text-xs font-semibold">Fecha de vencimiento<input type="date" className={inputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <label className="text-xs font-semibold">Sede de cobro<select className={inputClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Sin sede específica</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Descuento<input type="number" min="0" max={subtotal} className={inputClass} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label>
      <label className="text-xs font-semibold sm:col-span-2 lg:col-span-4">Notas<textarea rows={3} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </div>
    <div className="mt-3 flex justify-end"><button disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Guardar cambios</button></div>
  </form>;
}
