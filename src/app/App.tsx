import { lazy, Suspense, useEffect, useState } from "react";
import {
  BarChart2, ClipboardList, Cpu, FileText, LayoutDashboard, LogOut,
  Loader2, MapPin, Menu, Settings, Users, Wrench, X,
  type LucideIcon,
} from "lucide-react";
import type { Profile } from "../auth/AuthProvider";

const AssetsGlobalScreen = lazy(() => import("../features/assets/AssetsGlobal").then((module) => ({ default: module.AssetsGlobalScreen })));
const ClientsScreen = lazy(() => import("../features/clients/ClientScreens").then((module) => ({ default: module.ClientsScreen })));
const ClientDetailScreen = lazy(() => import("../features/clients/ClientScreens").then((module) => ({ default: module.ClientDetailScreen })));
const LocationDetailScreen = lazy(() => import("../features/clients/ClientScreens").then((module) => ({ default: module.LocationDetailScreen })));
const DashboardScreen = lazy(() => import("../features/dashboard/Dashboard").then((module) => ({ default: module.DashboardScreen })));
const InvoicesScreen = lazy(() => import("../features/invoices/Invoices").then((module) => ({ default: module.InvoicesScreen })));
const LocationsScreen = lazy(() => import("../features/locations/Locations").then((module) => ({ default: module.LocationsScreen })));
const ReportsScreen = lazy(() => import("../features/reports/Reports").then((module) => ({ default: module.ReportsScreen })));
const AdministrationScreen = lazy(() => import("../features/settings/Administration").then((module) => ({ default: module.AdministrationScreen })));
const WorkOrdersScreen = lazy(() => import("../features/work-orders/WorkOrders").then((module) => ({ default: module.WorkOrdersScreen })));
const WorkOrderFormScreen = lazy(() => import("../features/work-orders/WorkOrders").then((module) => ({ default: module.WorkOrderFormScreen })));

type Screen =
  | "dashboard"
  | "clients"
  | "client-detail"
  | "locations"
  | "location-detail"
  | "equipment"
  | "orders"
  | "new-work-order"
  | "work-order-detail"
  | "invoices"
  | "reports"
  | "settings";

type NavigationId = "dashboard" | "clients" | "locations" | "equipment" | "orders" | "invoices" | "reports" | "settings";

interface NavigationItem {
  id: NavigationId;
  screen: Screen;
  label: string;
  icon: LucideIcon;
}

interface AppHistoryState {
  gestorApp: true;
  depth: number;
  screen: Screen;
  selectedClient: string;
  selectedLocation: string;
  selectedAsset: string;
  selectedWorkOrder: string;
}

const navigation: NavigationItem[] = [
  { id: "dashboard", screen: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "clients", screen: "clients", label: "Clientes", icon: Users },
  { id: "locations", screen: "locations", label: "Sedes", icon: MapPin },
  { id: "equipment", screen: "equipment", label: "Equipos", icon: Cpu },
  { id: "orders", screen: "orders", label: "Órdenes", icon: ClipboardList },
  { id: "invoices", screen: "invoices", label: "Facturas", icon: FileText },
  { id: "reports", screen: "reports", label: "Reportes", icon: BarChart2 },
  { id: "settings", screen: "settings", label: "Configuración", icon: Settings },
];

const mobileNavigation = navigation.filter((item) => ["dashboard", "clients", "orders", "invoices", "settings"].includes(item.id));

function activeNavigation(screen: Screen): NavigationId {
  if (screen === "client-detail") return "clients";
  if (screen === "location-detail") return "locations";
  if (screen === "new-work-order" || screen === "work-order-detail") return "orders";
  return screen;
}

function screenTitle(screen: Screen) {
  const titles: Record<Screen, string> = {
    dashboard: "Panel principal",
    clients: "Clientes",
    "client-detail": "Detalle del cliente",
    locations: "Sedes",
    "location-detail": "Detalle de sede",
    equipment: "Equipos",
    orders: "Órdenes de trabajo",
    "new-work-order": "Nueva orden de trabajo",
    "work-order-detail": "Detalle de orden",
    invoices: "Facturas y cobros",
    reports: "Reportes",
    settings: "Configuración de empresa",
  };
  return titles[screen];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleLabel(role: Profile["role"]) {
  if (role === "admin") return "Administrador";
  if (role === "billing") return "Facturación";
  return "Técnico";
}

function Sidebar({ active, profile, open, onNavigate, onClose }: {
  active: NavigationId;
  profile: Profile;
  open: boolean;
  onNavigate: (screen: Screen) => void;
  onClose: () => void;
}) {
  return <>
    {open && <button type="button" aria-label="Cerrar menú" onClick={onClose} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
    <aside className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col bg-[#1a3558] text-white shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#f97316]"><Wrench size={16} /></span>
        <div><p className="text-sm font-bold leading-tight">Gestor de</p><p className="text-sm font-bold leading-tight text-[#f97316]">Servicios</p></div>
        <button type="button" aria-label="Cerrar menú" onClick={onClose} className="ml-auto text-white/60 hover:text-white lg:hidden"><X size={18} /></button>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-2 py-4">
        {navigation.map(({ id, screen, label, icon: Icon }) => <button type="button" key={id} onClick={() => { onNavigate(screen); onClose(); }} className={`mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${active === id ? "bg-[#f97316] font-medium text-white" : "text-blue-100/70 hover:bg-white/10 hover:text-white"}`}><Icon size={17} />{label}</button>)}
      </nav>
      <div className="border-t border-white/10 px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f97316] text-xs font-bold">{initials(profile.full_name)}</span><div className="min-w-0"><p className="truncate text-xs font-medium">{profile.full_name}</p><p className="text-xs text-blue-300/60">{roleLabel(profile.role)}</p></div></div></div>
    </aside>
  </>;
}

function BottomNavigation({ active, onNavigate }: { active: NavigationId; onNavigate: (screen: Screen) => void }) {
  return <nav aria-label="Navegación móvil" className="z-30 flex shrink-0 border-t border-white/10 bg-[#1a3558] pb-[env(safe-area-inset-bottom)] lg:hidden">
    {mobileNavigation.map(({ id, screen, label, icon: Icon }) => <button type="button" key={id} onClick={() => onNavigate(screen)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${active === id ? "text-[#f97316]" : "text-blue-200/50"}`}><Icon size={20} />{label}</button>)}
  </nav>;
}

export default function App({ profile, onSignOut }: { profile: Profile; onSignOut: () => Promise<void> }) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState("");

  useEffect(() => {
    const initial: AppHistoryState = {
      gestorApp: true, depth: 0, screen: "dashboard",
      selectedClient: "", selectedLocation: "", selectedAsset: "", selectedWorkOrder: "",
    };
    if (!window.history.state?.gestorApp) {
      window.history.replaceState(initial, "");
      window.history.pushState(initial, "");
    }

    const handleBack = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null;
      if (!state?.gestorApp) return;
      setScreen(state.screen);
      setSelectedClient(state.selectedClient);
      setSelectedLocation(state.selectedLocation);
      setSelectedAsset(state.selectedAsset);
      setSelectedWorkOrder(state.selectedWorkOrder);
      setSidebarOpen(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, []);

  useEffect(() => {
    const current = window.history.state as AppHistoryState | undefined;
    if (!current?.gestorApp) return;
    window.history.replaceState({
      ...current, screen, selectedClient, selectedLocation, selectedAsset, selectedWorkOrder,
    } satisfies AppHistoryState, "");
  }, [screen, selectedAsset, selectedClient, selectedLocation, selectedWorkOrder]);

  const pushScreen = (next: Screen) => {
    const current = window.history.state as AppHistoryState | undefined;
    window.history.pushState({
      gestorApp: true,
      depth: (current?.gestorApp ? current.depth : 0) + 1,
      screen: next,
      selectedClient,
      selectedLocation,
      selectedAsset,
      selectedWorkOrder,
    } satisfies AppHistoryState, "");
  };

  const navigate = (next: Screen) => {
    if (next === screen) return;
    pushScreen(next);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateRoot = (next: Screen) => {
    if (next !== screen) pushScreen(next);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    const current = window.history.state as AppHistoryState | undefined;
    if (current?.gestorApp && current.depth > 0) {
      window.history.back();
      return;
    }
    navigateRoot("dashboard");
  };

  const active = activeNavigation(screen);

  return <div className="flex h-[100dvh] overflow-hidden overscroll-none bg-background">
    <Sidebar active={active} profile={profile} open={sidebarOpen} onNavigate={navigateRoot} onClose={() => setSidebarOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button type="button" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted lg:hidden"><Menu size={20} /></button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{screenTitle(screen)}</p>
        <div className="flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block"><p className="text-xs font-semibold">{profile.full_name}</p><p className="text-[11px] text-muted-foreground">{roleLabel(profile.role)}</p></div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f97316] text-xs font-bold text-white">{initials(profile.full_name)}</span>
          <button type="button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void onSignOut()} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><LogOut size={17} /></button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background px-4 py-5 sm:px-6 lg:px-8 lg:pb-8">
        <Suspense fallback={<div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div>}>
        {screen === "dashboard" && <DashboardScreen onNavigate={(next) => {
          if (next === "new-work-order") { setSelectedClient(""); setSelectedLocation(""); setSelectedAsset(""); setSelectedWorkOrder(""); }
          navigate(next);
        }} />}
        {screen === "clients" && <ClientsScreen onNav={navigate} onSelectClient={(id) => { setSelectedClient(id); setSelectedLocation(""); setSelectedAsset(""); }} />}
        {screen === "client-detail" && <ClientDetailScreen clientId={selectedClient} canAdminister={profile.role === "admin"} onBack={goBack} onNav={navigate} onSelectLocation={(id) => { setSelectedLocation(id); setSelectedAsset(""); }} />}
        {screen === "locations" && <LocationsScreen onOpen={(id) => { setSelectedLocation(id); setSelectedAsset(""); navigate("location-detail"); }} />}
        {screen === "location-detail" && <LocationDetailScreen locationId={selectedLocation} canAdminister={profile.role === "admin"} onBack={goBack} onNewWorkOrder={(clientId, branchId, assetId) => { setSelectedClient(clientId); setSelectedLocation(branchId); setSelectedAsset(assetId ?? ""); setSelectedWorkOrder(""); navigate("new-work-order"); }} onOpenWorkOrder={(id) => { setSelectedWorkOrder(id); navigate("work-order-detail"); }} />}
        {screen === "equipment" && <AssetsGlobalScreen onOpenBranch={(id) => { setSelectedLocation(id); setSelectedAsset(""); navigate("location-detail"); }} />}
        {screen === "orders" && <WorkOrdersScreen canAdminister={profile.role === "admin"} onCreate={() => { setSelectedWorkOrder(""); setSelectedClient(""); setSelectedLocation(""); setSelectedAsset(""); navigate("new-work-order"); }} onEdit={(id) => { setSelectedWorkOrder(id); navigate("work-order-detail"); }} />}
        {(screen === "new-work-order" || screen === "work-order-detail") && <WorkOrderFormScreen orderId={screen === "work-order-detail" ? selectedWorkOrder : undefined} initialClientId={screen === "new-work-order" ? selectedClient : undefined} initialBranchId={screen === "new-work-order" ? selectedLocation : undefined} initialAssetId={screen === "new-work-order" ? selectedAsset : undefined} canAdminister={profile.role === "admin"} onBack={goBack} onSaved={() => navigateRoot("orders")} />}
        {screen === "invoices" && <InvoicesScreen canAdminister={profile.role === "admin"} />}
        {screen === "reports" && <ReportsScreen canAdminister={profile.role === "admin"} />}
        {screen === "settings" && <AdministrationScreen currentUserId={profile.id} role={profile.role} />}
        </Suspense>
      </main>
      <BottomNavigation active={active} onNavigate={navigateRoot} />
    </div>
  </div>;
}
