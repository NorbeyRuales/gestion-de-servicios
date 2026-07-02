import { useState } from "react";
import { Eye, FileCheck2, Loader2, Paperclip, RefreshCw, Trash2 } from "lucide-react";
import {
  createPaymentProof, deletePaymentProof, getPaymentProofUrl, replacePaymentProof,
  type PaymentProof,
} from "./paymentProofs";

interface PaymentProofControlProps {
  invoiceId: string;
  paymentId: string;
  proofs: PaymentProof[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible gestionar el comprobante.";
}

export function PaymentProofControl({ invoiceId, paymentId, proofs, onChanged, onError }: PaymentProofControlProps) {
  const [busy, setBusy] = useState(false);
  const proof = proofs[0];

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (proof) await replacePaymentProof(invoiceId, proof, file);
      else await createPaymentProof(invoiceId, paymentId, file);
      await onChanged();
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    if (!proof) return;
    const newTab = window.open("", "_blank");
    try {
      const url = await getPaymentProofUrl(proof.file_path);
      if (newTab) newTab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      newTab?.close();
      onError(errorMessage(error));
    }
  };

  const remove = async () => {
    if (!proof || !window.confirm("¿Eliminar este comprobante de pago?")) return;
    setBusy(true);
    try {
      await deletePaymentProof(proof);
      await onChanged();
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 size={13} className="animate-spin" />Procesando…</span>;

  return <div className="mt-1.5 flex flex-wrap items-center gap-2">
    {proof ? <>
      <span className="inline-flex items-center gap-1 font-semibold text-green-700"><FileCheck2 size={13} />Comprobante adjunto</span>
      <button type="button" onClick={() => void view()} className="inline-flex items-center gap-1 font-semibold text-blue-700"><Eye size={13} />Ver</button>
      <label className="inline-flex cursor-pointer items-center gap-1 font-semibold text-orange-700"><RefreshCw size={13} />Reemplazar<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => void upload(event)} /></label>
      <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1 font-semibold text-red-700"><Trash2 size={13} />Eliminar</button>
    </> : <label className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#f97316]"><Paperclip size={13} />Adjuntar comprobante<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => void upload(event)} /></label>}
  </div>;
}
