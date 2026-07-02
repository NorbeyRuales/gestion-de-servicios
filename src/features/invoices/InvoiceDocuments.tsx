import { useState } from "react";
import { Download, Eye, FileArchive, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type InvoiceStatus = "pending" | "partial" | "paid" | "void";

export interface InvoiceDocument {
  id: string;
  invoice_id: string;
  version: number;
  file_path: string;
  invoice_status: InvoiceStatus;
  grand_total: number;
  paid_total: number;
  balance_total: number;
  generated_by: string;
  created_at: string;
}

interface InvoiceDocumentsProps {
  invoiceNumber: string;
  documents: InvoiceDocument[];
  isStale: boolean;
  generating: boolean;
  onGenerate: () => Promise<void>;
  onError: (message: string) => void;
}

const statusLabels: Record<InvoiceStatus, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagada",
  void: "Anulada",
};

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function fileName(invoiceNumber: string, version: number) {
  const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safeNumber}-v${version}.pdf`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible abrir el documento.";
}

export function InvoiceDocuments({ invoiceNumber, documents, isStale, generating, onGenerate, onError }: InvoiceDocumentsProps) {
  const [documentAction, setDocumentAction] = useState<string | null>(null);

  const viewDocument = async (document: InvoiceDocument) => {
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      onError("El navegador bloqueó la nueva pestaña. Permite ventanas emergentes e inténtalo de nuevo.");
      return;
    }
    preview.opener = null;
    setDocumentAction(`view-${document.id}`);
    try {
      const { data, error } = await supabase.storage.from("invoices").createSignedUrl(document.file_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("No se pudo crear el enlace temporal.");
      preview.location.href = data.signedUrl;
    } catch (error) {
      preview.close();
      onError(errorMessage(error));
    } finally {
      setDocumentAction(null);
    }
  };

  const downloadDocument = async (document: InvoiceDocument) => {
    setDocumentAction(`download-${document.id}`);
    try {
      const { data, error } = await supabase.storage.from("invoices").download(document.file_path);
      if (error || !data) throw error ?? new Error("No se pudo descargar el documento.");
      const url = URL.createObjectURL(data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = fileName(invoiceNumber, document.version);
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setDocumentAction(null);
    }
  };

  return <section className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold"><FileArchive size={16} />Documentos de la factura</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {documents.length === 0 ? "Aún no hay copias archivadas." : `${documents.length} versión${documents.length === 1 ? "" : "es"} conservada${documents.length === 1 ? "" : "s"}.`}
        </p>
      </div>
      <button
        type="button"
        disabled={generating}
        onClick={() => void onGenerate()}
        className="flex items-center gap-2 rounded-lg bg-[#1a3558] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : documents.length > 0 ? <RefreshCw size={14} /> : <FileArchive size={14} />}
        {documents.length > 0 ? "Regenerar y archivar" : "Generar y archivar PDF"}
      </button>
    </div>

    {isStale && documents.length > 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
      Los pagos o el estado cambiaron después de la última copia. Regenera el PDF para archivar la versión actualizada.
    </p>}

    {documents.length > 0 && <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {documents.map((document, index) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong>Versión {document.version}</strong>
            {index === 0 && !isStale && <span className="rounded bg-green-50 px-1.5 py-0.5 font-semibold text-green-700">Actual</span>}
            {index === 0 && isStale && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">Desactualizada</span>}
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {new Date(document.created_at).toLocaleString("es-CO")} · {statusLabels[document.invoice_status]} · Pagado {money(Number(document.paid_total))} · Saldo {money(Number(document.balance_total))}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={documentAction !== null} onClick={() => void viewDocument(document)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold disabled:opacity-50">
            {documentAction === `view-${document.id}` ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}Ver
          </button>
          <button type="button" disabled={documentAction !== null} onClick={() => void downloadDocument(document)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold disabled:opacity-50">
            {documentAction === `download-${document.id}` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}Descargar
          </button>
        </div>
      </div>)}
    </div>}
  </section>;
}
