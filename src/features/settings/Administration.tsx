import { useState } from "react";
import { Building2, Layers3, ShieldCheck, Trash2, UserRoundCog, Wrench } from "lucide-react";
import { AssetCategoriesManagement } from "./AssetCategoriesManagement";
import type { UserRole } from "../../auth/AuthProvider";
import { CompanySettingsScreen } from "./CompanySettings";
import { DeletionLogs } from "./DeletionLogs";
import { ServiceTypesManagement } from "./ServiceTypesManagement";
import { UsersManagement } from "./UsersManagement";
import { TechniciansManagement } from "./TechniciansManagement";

type Tab = "company" | "users" | "technicians" | "services" | "categories" | "deletions";

export function AdministrationScreen({ currentUserId, role }: { currentUserId: string; role: UserRole }) {
  const [tab, setTab] = useState<Tab>("company");
  const isAdmin = role === "admin";
  const tabs = [
    { id: "company" as const, label: "Empresa", icon: Building2 },
    ...(isAdmin ? [
      { id: "users" as const, label: "Usuarios y roles", icon: ShieldCheck },
      { id: "technicians" as const, label: "Técnicos", icon: UserRoundCog },
      { id: "services" as const, label: "Tipos de servicio", icon: Wrench },
      { id: "categories" as const, label: "Categorías", icon: Layers3 },
      { id: "deletions" as const, label: "Eliminaciones", icon: Trash2 },
    ] : []),
  ];

  return <div>
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === id ? "border-[#f97316] text-[#f97316]" : "border-transparent text-muted-foreground"}`}><Icon size={16} />{label}</button>)}</div>
    {tab === "company" && <CompanySettingsScreen canEdit={isAdmin} />}
    {isAdmin && tab === "users" && <UsersManagement currentUserId={currentUserId} />}
    {isAdmin && tab === "technicians" && <TechniciansManagement />}
    {isAdmin && tab === "services" && <ServiceTypesManagement />}
    {isAdmin && tab === "categories" && <AssetCategoriesManagement />}
    {isAdmin && tab === "deletions" && <DeletionLogs />}
  </div>;
}
