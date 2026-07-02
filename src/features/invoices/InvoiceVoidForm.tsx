import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { confirmDestructiveAction } from "../../app/components/ui/destructive-dialog";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message.replace(/^.*?: /, "");
  return "No fue posible anular la factura.";
}

export function InvoiceVoidForm({ invoiceId, invoiceNumber, onCancel, onVoided }: {
  invoiceId: string;
  invoiceNumber: string;
  onCancel: () => void;
  onVoided: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason.trim().length < 5) return setError("Escribe un motivo de al menos 5 caracteres.");
    if (!await confirmDestructiveAction({ title: `Anular factura ${invoiceNumber}`, description: "La factura se conservará como anulada y sus órdenes volverán a estar disponibles para facturar.", confirmLabel: "Sí, anular" })) return;
    setBusy(true);
    setError("");
    const { error: voidError } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: reason.trim() });
    if (voidError) {
      setError(messageFrom(voidError));
      setBusy(false);
      return;
    }
    await onVoided();
    setBusy(false);
  };

  return <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
    <div className="flex gap-3"><AlertTriangle size={20} className="shrink-0 text-red-600" /><div className="flex-1"><h4 className="text-sm font-bold text-red-800">Anular factura</h4><p className="mt-1 text-xs text-red-700">Solo es posible si no tiene pagos. La factura se conservará en el historial y sus órdenes volverán a estado Terminado.</p>{error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}<label className="mt-3 block text-xs font-semibold text-red-900">Motivo obligatorio<textarea autoFocus rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-red-200 bg-white p-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-100" /></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Cancelar</button><button type="submit" disabled={busy} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />}Confirmar anulación</button></div></div></div>
  </form>;
}
