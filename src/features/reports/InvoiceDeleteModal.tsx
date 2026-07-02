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
    setDeleting(true);
    const { data, error: deleteError } = await supabase.rpc("delete_invoice_admin", { p_invoice_id: invoice.id, p_reason: reason.trim() || "Sin motivo especificado" });
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

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[3px] animate-in fade-in-0" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="delete-invoice-title" className="w-full max-w-lg overflow-hidden rounded-[1.35rem] border border-red-200/80 bg-card shadow-[0_30px_90px_-24px_rgba(15,23,42,0.6)] animate-in fade-in-0 zoom-in-95 duration-200">
      <div className="flex items-start gap-3 border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-orange-50/60 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-sm ring-4 ring-white"><AlertTriangle size={21} /></span><div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Acción irreversible</p><h2 id="delete-invoice-title" className="mt-0.5 font-bold tracking-tight">Eliminar factura definitivamente</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.invoice_number} · {invoice.clientName}</p></div><button type="button" disabled={deleting} onClick={onCancel} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full border border-red-100 bg-white text-muted-foreground shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><X size={17} /></button></div>
      <form onSubmit={(event) => void remove(event)} className="space-y-4 p-5">
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm leading-relaxed text-red-800 shadow-sm"><strong>Esta acción no se puede deshacer.</strong> Se eliminarán la factura, sus versiones PDF y sus vínculos con órdenes. Las órdenes volverán al estado Terminado. No se permite eliminar facturas con pagos.</div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="block text-sm font-semibold">Motivo de eliminación <span className="font-normal text-muted-foreground">(opcional)</span><textarea autoFocus rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-red-400" placeholder="Puedes explicar por qué se elimina esta factura…" /></label>
        <div className="flex justify-end gap-2"><button type="button" disabled={deleting} onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">No, cancelar</button><button disabled={deleting} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}Sí, eliminar</button></div>
      </form>
    </section>
  </div>;
}
