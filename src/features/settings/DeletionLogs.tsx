import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ToastFeedback } from "../../components/ToastFeedback";

interface DeletionLog {
  id: string;
  entity_type: string;
  entity_label: string;
  reason: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

const entityLabels: Record<string, string> = {
  client: "Cliente", branch: "Sede", area: "Área", asset: "Equipo",
  service_type: "Tipo de servicio", work_order: "Orden", user: "Usuario",
  invoice: "Factura",
};

export function DeletionLogs() {
  const [logs, setLogs] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("deletion_logs")
      .select("id,entity_type,entity_label,reason,created_at,profiles!deletion_logs_deleted_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (queryError) setError(queryError.message); else setLogs((data ?? []) as unknown as DeletionLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  return <div className="space-y-4">
    <div><h2 className="font-bold">Registro de eliminaciones</h2><p className="text-sm text-muted-foreground">Auditoría de eliminaciones definitivas realizadas por administradores.</p></div>
    <ToastFeedback error={error} />
    {logs.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No hay eliminaciones registradas.</div> : <section className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {logs.map((log) => <article key={log.id} className="flex items-start gap-3 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><Trash2 size={15} /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{log.entity_label}</strong><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{entityLabels[log.entity_type] ?? log.entity_type}</span></div><p className="mt-1 text-xs text-muted-foreground">Motivo: {log.reason}</p><p className="mt-1 text-xs text-muted-foreground">Por {log.profiles?.full_name ?? "Administrador"}</p></div>
        <time className="shrink-0 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("es-CO")}</time>
      </article>)}
    </section>}
  </div>;
}
