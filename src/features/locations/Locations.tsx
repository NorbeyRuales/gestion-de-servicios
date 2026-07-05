import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Loader2, MapPin, Phone, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ToastFeedback } from "../../components/ToastFeedback";

interface ClientOption { id: string; name: string }
interface BranchRecord {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  is_active: boolean;
}
interface AssetLink { id: string; branch_id: string }
interface WorkOrderLink { id: string; execution_branch_id: string; status: string }

const inputClass = "rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible cargar las sedes.";
}

export function LocationsScreen({ onOpen }: { onOpen: (branchId: string) => void }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [assets, setAssets] = useState<AssetLink[]>([]);
  const [orders, setOrders] = useState<WorkOrderLink[]>([]);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [clientsResult, branchesResult, assetsResult, ordersResult] = await Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("branches").select("id,client_id,name,address,manager_name,manager_phone,is_active").order("name"),
        supabase.from("assets").select("id,branch_id"),
        supabase.from("work_orders").select("id,execution_branch_id,status"),
      ]);
      if (!active) return;
      const firstError = clientsResult.error || branchesResult.error || assetsResult.error || ordersResult.error;
      if (firstError) setError(messageFrom(firstError));
      if (!clientsResult.error) setClients((clientsResult.data ?? []) as ClientOption[]);
      if (!branchesResult.error) setBranches((branchesResult.data ?? []) as BranchRecord[]);
      if (!assetsResult.error) setAssets((assetsResult.data ?? []) as AssetLink[]);
      if (!ordersResult.error) setOrders((ordersResult.data ?? []) as WorkOrderLink[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => branches.filter((branch) => {
    const client = clients.find((item) => item.id === branch.client_id)?.name ?? "";
    const term = search.toLowerCase();
    const matchesSearch = [branch.name, branch.address, branch.manager_name, branch.manager_phone, client].some((value) => value?.toLowerCase().includes(term));
    const matchesClient = !clientId || branch.client_id === clientId;
    const matchesStatus = status === "all" || (status === "active" ? branch.is_active : !branch.is_active);
    return matchesSearch && matchesClient && matchesStatus;
  }), [branches, clientId, clients, search, status]);

  return <div>
    <div className="mb-5"><h1 className="text-xl font-bold sm:text-2xl">Sedes</h1><p className="mt-0.5 text-sm text-muted-foreground">Consulta todas las sedes registradas por cliente</p></div>
    <ToastFeedback error={error} />
    <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[1fr_220px_160px]"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} w-full pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sede, dirección o encargado…" /></div><select className={inputClass} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></div>
    {loading ? <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center text-sm text-muted-foreground">No hay sedes que coincidan con los filtros.</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((branch) => {
      const client = clients.find((item) => item.id === branch.client_id);
      const assetCount = assets.filter((asset) => asset.branch_id === branch.id).length;
      const pending = orders.filter((order) => order.execution_branch_id === branch.id && !["completed", "cancelled", "invoiced"].includes(order.status)).length;
      return <button key={branch.id} onClick={() => onOpen(branch.id)} className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-[#1a3558]"><MapPin size={18} /></span><span className={`rounded px-2 py-1 text-xs font-semibold ${branch.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{branch.is_active ? "Activa" : "Inactiva"}</span></div><h2 className="mt-3 font-bold">{branch.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Building2 size={12} />{client?.name || "Cliente"}</p><p className="mt-2 min-h-8 text-xs text-muted-foreground">{branch.address || "Sin dirección registrada"}</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Phone size={12} />{branch.manager_name || "Sin encargado"} · {branch.manager_phone || "Sin teléfono"}</p><div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs"><span>{assetCount} equipo{assetCount === 1 ? "" : "s"} · {pending} pendiente{pending === 1 ? "" : "s"}</span><ChevronRight size={16} className="text-[#f97316]" /></div></button>;
    })}</div>}
  </div>;
}
