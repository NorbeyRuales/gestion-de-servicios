import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

interface DestructiveRequest {
  title: string;
  description: string;
  subject?: string;
  confirmLabel: string;
  showReason: boolean;
  resolve: (value: string | boolean | null) => void;
}

let presentDialog: ((request: DestructiveRequest) => void) | null = null;

export function confirmDestructiveAction(options: { title: string; description: string; confirmLabel?: string }) {
  return new Promise<boolean>((resolve) => {
    if (!presentDialog) return resolve(false);
    presentDialog({ ...options, confirmLabel: options.confirmLabel ?? "Sí, confirmar", showReason: false, resolve: (value) => resolve(value === true) });
  });
}

export function requestDeletionReason(subject: string) {
  return new Promise<string | null>((resolve) => {
    if (!presentDialog) return resolve(null);
    presentDialog({
      title: "Eliminar definitivamente",
      description: "Esta acción no se puede deshacer. El registro solo se eliminará si no tiene información relacionada.",
      subject,
      confirmLabel: "Sí, eliminar",
      showReason: true,
      resolve: (value) => resolve(typeof value === "string" ? value : null),
    });
  });
}

export function DestructiveDialogHost() {
  const [request, setRequest] = useState<DestructiveRequest | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    presentDialog = (next) => { setReason(""); setError(""); setRequest(next); };
    return () => { presentDialog = null; };
  }, []);

  const close = () => {
    request?.resolve(null);
    setRequest(null);
  };

  const confirm = () => {
    if (!request) return;
    request.resolve(request.showReason ? (reason.trim() || "Sin motivo especificado") : true);
    setRequest(null);
  };

  return (
    <AlertDialogPrimitive.Root open={Boolean(request)} onOpenChange={(open) => { if (!open && request) close(); }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.35rem] border border-red-200/80 bg-card shadow-[0_30px_90px_-24px_rgba(15,23,42,0.6)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200">
          <header className="relative flex items-start gap-3 border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-orange-50/60 p-5 pr-16">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-sm ring-4 ring-white"><AlertTriangle size={21} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Acción irreversible</p>
              <AlertDialogPrimitive.Title className="mt-0.5 text-lg font-bold tracking-tight">{request?.title}</AlertDialogPrimitive.Title>
              {request?.subject && <p className="mt-1 truncate text-sm font-semibold text-red-700">{request.subject}</p>}
            </div>
            <button type="button" onClick={close} aria-label="Cerrar" className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-red-100 bg-white text-muted-foreground shadow-sm transition hover:bg-red-50 hover:text-red-600"><X size={17} /></button>
          </header>
          <div className="space-y-4 p-5">
            <AlertDialogPrimitive.Description className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm leading-relaxed text-red-800">{request?.description}</AlertDialogPrimitive.Description>
            {request?.showReason && <label className="block text-sm font-semibold">Motivo de eliminación <span className="font-normal text-muted-foreground">(opcional)</span><textarea autoFocus rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100" placeholder="Puedes explicar por qué se elimina este registro…" /></label>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <AlertDialogPrimitive.Cancel onClick={close} className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-muted">No, cancelar</AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action onClick={(event) => { event.preventDefault(); confirm(); }} className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"><Trash2 size={15} />{request?.confirmLabel}</AlertDialogPrimitive.Action>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
