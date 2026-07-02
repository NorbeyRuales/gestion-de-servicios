import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Cpu, Loader2, MapPin, Package, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { QUERY_LIMITS } from "../../lib/queryLimits";

type AssetStatus = "operational" | "needs_review" | "under_repair" | "out_of_service" | "retired";
interface ClientOption { id: string; name: string }
interface BranchOption { id: string; client_id: string; name: string }
interface AreaOption { id: string; branch_id: string; name: string }
interface AssetRecord {
  id: string;
  branch_id: string;
  area_id: string | null;
  internal_code: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  status: AssetStatus;
  last_maintenance_date: string | null;
  is_active: boolean;
}

const labels: Record<AssetStatus, string> = { operational: "Operativo", needs_review: "Requiere revisión", under_repair: "En reparación", out_of_service: "Fuera de servicio", retired: "Retirado" };
const styles: Record<AssetStatus, string> = { operational: "bg-green-50 text-green-700", needs_review: "bg-amber-50 text-amber-700", under_repair: "bg-blue-50 text-blue-700", out_of_service: "bg-red-50 text-red-700", retired: "bg-slate-100 text-slate-600" };
const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible cargar los equipos.";
}

export function AssetsGlobalScreen({ onOpenBranch }: { onOpenBranch: (branchId: string) => void }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<AssetStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [clientsResult, branchesResult, areasResult, assetsResult] = await Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("branches").select("id,client_id,name").order("name"),
        supabase.from("areas").select("id,branch_id,name").order("name"),
        supabase.from("assets").select("id,branch_id,area_id,internal_code,name,category,brand,model,status,last_maintenance_date,is_active").order("name").limit(QUERY_LIMITS.list),
      ]);
      if (!active) return;
      const firstError = clientsResult.error || branchesResult.error || areasResult.error || assetsResult.error;
      if (firstError) setError(messageFrom(firstError));
      if (!clientsResult.error) setClients((clientsResult.data ?? []) as ClientOption[]);
      if (!branchesResult.error) setBranches((branchesResult.data ?? []) as BranchOption[]);
      if (!areasResult.error) setAreas((areasResult.data ?? []) as AreaOption[]);
      if (!assetsResult.error) setAssets((assetsResult.data ?? []) as AssetRecord[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const clientBranches = branches.filter((branch) => !clientId || branch.client_id === clientId);
  const filtered = useMemo(() => assets.filter((asset) => {
    const branch = branches.find((item) => item.id === asset.branch_id);
    const client = clients.find((item) => item.id === branch?.client_id);
    const area = areas.find((item) => item.id === asset.area_id);
    const term = search.toLowerCase();
    const matchesSearch = [asset.name, asset.internal_code, asset.category, asset.brand, asset.model, branch?.name, client?.name, area?.name].some((value) => value?.toLowerCase().includes(term));
    return matchesSearch && (!clientId || branch?.client_id === clientId) && (!branchId || asset.branch_id === branchId) && (status === "all" || asset.status === status);
  }), [areas, assets, branchId, branches, clientId, clients, search, status]);

  return <div>
    <div className="mb-5"><h1 className="text-xl font-bold sm:text-2xl">Equipos</h1><p className="mt-0.5 text-sm text-muted-foreground">Inventario global de equipos por cliente, sede y estado</p></div>
    {error && <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_210px_210px_190px]"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} w-full pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipo, código o categoría…" /></div><select className={inputClass} value={clientId} onChange={(event) => { setClientId(event.target.value); setBranchId(""); }}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select className={inputClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Todas las sedes</option>{clientBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos los estados</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {loading ? <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center"><Package className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No hay equipos que coincidan con los filtros.</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((asset) => {
      const branch = branches.find((item) => item.id === asset.branch_id);
      const client = clients.find((item) => item.id === branch?.client_id);
      const area = areas.find((item) => item.id === asset.area_id);
      return <article key={asset.id} className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#1a3558]"><Cpu size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold text-sm">{asset.name}</h2><p className="font-mono text-xs text-muted-foreground">{asset.internal_code}</p></div><span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${styles[asset.status]}`}>{labels[asset.status]}</span></div><p className="mt-2 text-xs text-muted-foreground">{asset.category} · {[asset.brand, asset.model].filter(Boolean).join(" ") || "Sin marca/modelo"}</p><p className="mt-1 text-xs text-muted-foreground">{client?.name || "Cliente"} · {branch?.name || "Sin sede"} · {area?.name || "Sin área"}</p>{!asset.is_active && <p className="mt-1 text-xs font-semibold text-red-600">Equipo inactivo</p>}</div></div><button onClick={() => onOpenBranch(asset.branch_id)} className="mt-3 flex w-full items-center justify-between border-t border-border pt-3 text-xs font-semibold text-[#f97316]"><span className="flex items-center gap-1"><MapPin size={13} />Abrir sede y gestionar equipo</span><ChevronRight size={15} /></button></article>;
    })}</div>}
  </div>;
}
