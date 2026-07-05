import App from "./app/App";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AuthScreen } from "./auth/AuthScreen";
import { Loader2 } from "lucide-react";
import { DestructiveDialogHost } from "./app/components/ui/destructive-dialog";
import { Toaster } from "./app/components/ui/sonner";

function AppGate() {
  const { session, profile, loading, passwordRecovery, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-[#eef3f8] grid place-items-center text-[#1a3558]"><div className="flex items-center gap-3"><Loader2 className="animate-spin" />Cargando sesión…</div></div>;
  }

  if (passwordRecovery) return <AuthScreen recovery />;
  if (!session || !profile) return <AuthScreen />;
  if (!profile.is_active) {
    return <div className="min-h-screen bg-[#eef3f8] grid place-items-center p-6"><div className="max-w-md bg-white rounded-xl border p-7 text-center"><h1 className="font-bold text-xl text-[#1a3558]">Cuenta desactivada</h1><p className="mt-2 text-slate-600">Solicita al administrador que reactive tu acceso.</p><button onClick={signOut} className="mt-5 text-[#f97316] font-semibold">Cerrar sesión</button></div></div>;
  }

  return <App profile={profile} onSignOut={signOut} />;
}

export default function AuthenticatedApp() {
  return <AuthProvider><AppGate /><DestructiveDialogHost /><Toaster position="top-right" richColors closeButton visibleToasts={4} gap={10} /></AuthProvider>;
}
