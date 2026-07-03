import { useState } from "react";
import { AlertCircle, Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { PaymentProof } from "./paymentProofs";
import { confirmDestructiveAction } from "../../app/components/ui/destructive-dialog";

type PaymentMethod = "cash" | "bank_transfer" | "nequi" | "bancolombia" | "daviplata" | "other";
interface PaymentAdminData {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  received_at_branch_id: string | null;
  reference: string | null;
  notes: string | null;
  proofs: PaymentProof[];
}
interface BranchOption { id: string; name: string }

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const methodLabels: Record<PaymentMethod, string> = { cash: "Efectivo", bank_transfer: "Transferencia bancaria", nequi: "Nequi", bancolombia: "Bancolombia", daviplata: "Daviplata", other: "Otro" };

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message.replace(/^.*?: /, "");
  return "No fue posible completar la operación.";
}

export function PaymentAdminForm({ payment, maxAmount, branches, onCancel, onSaved }: {
  payment: PaymentAdminData;
  maxAmount: number;
  branches: BranchOption[];
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [paymentDate, setPaymentDate] = useState(payment.payment_date);
  const [amount, setAmount] = useState(Number(payment.amount));
  const [method, setMethod] = useState<PaymentMethod>(payment.payment_method);
  const [branchId, setBranchId] = useState(payment.received_at_branch_id ?? "");
  const [reference, setReference] = useState(payment.reference ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  const validate = () => {
    if (!paymentDate) return "Selecciona la fecha del pago.";
    if (!Number.isFinite(amount) || amount <= 0) return "El valor debe ser mayor que cero.";
    if (amount > maxAmount) return "El valor supera el máximo disponible para esta factura.";
    if (reason.trim().length < 5) return "Escribe el motivo de la corrección (mínimo 5 caracteres).";
    return "";
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate();
    if (validation) return setError(validation);
    setBusy("save");
    setError("");
    const { error: updateError } = await supabase.rpc("update_payment_admin", {
      p_payment_id: payment.id,
      payload: { payment_date: paymentDate, amount, payment_method: method, received_at_branch_id: branchId || null, reference, notes },
      p_reason: reason.trim(),
    });
    if (updateError) {
      setError(messageFrom(updateError));
      setBusy(null);
      return;
    }
    await onSaved("Pago corregido correctamente.");
    setBusy(null);
  };

  const remove = async () => {
    if (!await confirmDestructiveAction({ title: "Eliminar pago", description: "El pago se eliminará definitivamente y el saldo de la factura será recalculado.", confirmLabel: "Sí, eliminar" })) return;
    setBusy("delete");
    setError("");
    const { error: deleteError } = await supabase.rpc("delete_payment_admin", { p_payment_id: payment.id, p_reason: reason.trim() || "Sin motivo especificado" });
    if (deleteError) {
      setError(messageFrom(deleteError));
      setBusy(null);
      return;
    }
    if (payment.proofs.length > 0) await supabase.storage.from("payment-proofs").remove(payment.proofs.map((proof) => proof.file_path));
    await onSaved("Pago eliminado y saldo recalculado correctamente.");
    setBusy(null);
  };

  return <form onSubmit={(event) => void save(event)} className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
    <div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-bold">Corregir pago</h5><button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground">Cancelar</button></div>
    {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"><AlertCircle size={14} />{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-semibold">Fecha<input type="date" className={inputClass} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
      <label className="text-xs font-semibold">Valor<input type="number" min="1" max={maxAmount} inputMode="numeric" placeholder="$ 0" className={inputClass} value={amount || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      <label className="text-xs font-semibold">Método<select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs font-semibold">Sede<select className={inputClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Sin sede</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Referencia<input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="text-xs font-semibold">Observación<input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">Motivo administrativo *<textarea rows={2} className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se corrige o elimina este pago…" /></label>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void remove()} disabled={Boolean(busy)} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60">{busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}Eliminar pago</button><button type="submit" disabled={Boolean(busy)} className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Guardar corrección</button></div>
  </form>;
}
