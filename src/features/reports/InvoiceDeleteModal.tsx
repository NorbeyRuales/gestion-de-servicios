import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface InvoiceDeleteModalProps {
  invoice: { id: string; invoice_number: string; clientName: string };
  onCancel: () => void;
  onDeleted: () => Promise<void>;
}

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message.replace(/^.*?: /, "");
  return "No fue posible eliminar la factura.";
}

export function InvoiceDeleteModal({ invoice, onCancel, onDeleted }: InvoiceDeleteModalProps) {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !deleting) onCancel(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [deleting, onCancel]);

  const remove = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 5) return setError("Escribe un motivo de al menos 5 caracteres.");
    if (confirmation.trim() !== invoice.invoice_number) return setError("El número de factura no coincide.");
    setDeleting(true);
    const { data, error: deleteError } = await supabase.rpc("delete_invoice_admin", { p_invoice_id: invoice.id, p_reason: reason.trim() });
    if (deleteError) {
      setError(messageFrom(deleteError));
      setDeleting(false);
      return;
    }

    const filePaths = (data ?? []) as string[];
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from("invoices").remove(filePaths);
      if (storageError) console.warn("La factura se eliminó, pero no fue posible limpiar todos sus PDFs", storageError);
    }
    await onDeleted();
    setDeleting(false);
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="delete-invoice-title" className="w-full max-w-lg rounded-2xl border border-red-200 bg-card shadow-2xl">
      <div className="flex items-start gap-3 border-b border-border p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"><AlertTriangle size={20} /></span><div className="flex-1"><h2 id="delete-invoice-title" className="font-bold">Eliminar factura definitivamente</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.invoice_number} · {invoice.clientName}</p></div><button type="button" disabled={deleting} onClick={onCancel} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted disabled:opacity-50"><X size={17} /></button></div>
      <form onSubmit={(event) => void remove(event)} className="space-y-4 p-5">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Esta acción no se puede deshacer.</strong> Se eliminarán la factura, sus versiones PDF y sus vínculos con órdenes. Las órdenes volverán al estado Terminado. No se permite eliminar facturas con pagos.</div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-semibold">Motivo de eliminación<textarea autoFocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-red-400" placeholder="Explica por qué se elimina esta factura…" /></label>
        <label className="block text-sm font-semibold">Escribe <span className="font-mono text-red-700">{invoice.invoice_number}</span> para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-red-400" /></label>
        <div className="flex justify-end gap-2"><button type="button" disabled={deleting} onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancelar</button><button disabled={deleting || reason.trim().length < 5 || confirmation.trim() !== invoice.invoice_number} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Eliminar definitivamente</button></div>
      </form>
    </section>
  </div>;
}
