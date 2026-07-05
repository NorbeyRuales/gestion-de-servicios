import { useEffect, useState } from "react";
import { Building2, ImagePlus, Landmark, Loader2, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ToastFeedback } from "../../components/ToastFeedback";

interface CompanySettings {
  id: number;
  business_name: string;
  document_type: string | null;
  document_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  payment_instructions: string | null;
  invoice_terms: string | null;
}

const emptySettings: CompanySettings = {
  id: 1,
  business_name: "Gestor de Servicios",
  document_type: "NIT",
  document_number: "",
  address: "",
  phone: "",
  email: "",
  logo_path: null,
  bank_name: "",
  account_type: "",
  account_number: "",
  account_holder: "",
  payment_instructions: "",
  invoice_terms: "",
};

const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 disabled:opacity-60";

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "No fue posible completar la operación.";
}

export function CompanySettingsScreen({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<CompanySettings>(emptySettings);
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase.from("company_settings").select("*").eq("id", 1).single();
      if (!active) return;
      if (queryError) {
        setError(messageFrom(queryError));
        setLoading(false);
        return;
      }
      const next = data as CompanySettings;
      setSettings(next);
      if (next.logo_path) {
        const { data: signed } = await supabase.storage.from("company-assets").createSignedUrl(next.logo_path, 3600);
        if (active) setLogoUrl(signed?.signedUrl ?? "");
      }
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const setField = (field: keyof CompanySettings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!settings.business_name.trim()) return setError("Escribe el nombre o razón social de la empresa.");
    if (settings.email && !/^\S+@\S+\.\S+$/.test(settings.email)) return setError("El correo electrónico no es válido.");

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from("company_settings").update({
      business_name: settings.business_name.trim(),
      document_type: settings.document_type?.trim() || null,
      document_number: settings.document_number?.trim() || null,
      address: settings.address?.trim() || null,
      phone: settings.phone?.trim() || null,
      email: settings.email?.trim() || null,
      bank_name: settings.bank_name?.trim() || null,
      account_type: settings.account_type?.trim() || null,
      account_number: settings.account_number?.trim() || null,
      account_holder: settings.account_holder?.trim() || null,
      payment_instructions: settings.payment_instructions?.trim() || null,
      invoice_terms: settings.invoice_terms?.trim() || null,
      updated_by: userData.user?.id ?? null,
    }).eq("id", 1);
    setSaving(false);
    if (updateError) return setError(messageFrom(updateError));
    setSuccess("Configuración empresarial guardada correctamente.");
  };

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess("");
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setError("El logo debe ser una imagen PNG o JPG.");
    if (file.size > 5 * 1024 * 1024) return setError("El logo no puede superar 5 MB.");

    setUploading(true);
    const extension = file.type === "image/png" ? "png" : "jpg";
    const newPath = `company/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("company-assets").upload(newPath, file, { contentType: file.type });
    if (uploadError) {
      setUploading(false);
      return setError(messageFrom(uploadError));
    }

    const oldPath = settings.logo_path;
    const { error: updateError } = await supabase.from("company_settings").update({ logo_path: newPath }).eq("id", 1);
    if (updateError) {
      await supabase.storage.from("company-assets").remove([newPath]);
      setUploading(false);
      return setError(messageFrom(updateError));
    }
    if (oldPath) await supabase.storage.from("company-assets").remove([oldPath]);
    const { data: signed } = await supabase.storage.from("company-assets").createSignedUrl(newPath, 3600);
    setSettings((current) => ({ ...current, logo_path: newPath }));
    setLogoUrl(signed?.signedUrl ?? "");
    setSuccess("Logo actualizado correctamente.");
    setUploading(false);
  };

  if (loading) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return <div className="max-w-5xl">
    <div className="mb-5">
      <h1 className="text-xl font-bold sm:text-2xl">Configuración de empresa</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">Datos que aparecerán en las facturas y cuentas de cobro</p>
    </div>

    {!canEdit && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Solo un administrador puede modificar esta información.</div>}
    <ToastFeedback error={error} success={success} />

    <form onSubmit={(event) => void save(event)} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Building2 size={18} className="text-[#f97316]" />Identidad y contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:row-span-3">
            <p className="text-sm font-semibold">Logo</p>
            <div className="mt-1.5 grid h-40 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 p-3">
              {logoUrl ? <img src={logoUrl} alt={`Logo de ${settings.business_name}`} className="max-h-full max-w-full object-contain" /> : <div className="text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2" /><p>Sin logo configurado</p></div>}
            </div>
            {canEdit && <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted/40">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} {uploading ? "Subiendo…" : "Cambiar logo"}
              <input type="file" accept="image/png,image/jpeg" disabled={uploading} onChange={(event) => void uploadLogo(event)} className="sr-only" />
            </label>}
          </div>
          <label className="text-sm font-semibold">Nombre o razón social *<input disabled={!canEdit} className={inputClass} value={settings.business_name} onChange={(event) => setField("business_name", event.target.value)} required /></label>
          <div className="grid grid-cols-[110px_1fr] gap-3"><label className="text-sm font-semibold">Documento<select disabled={!canEdit} className={inputClass} value={settings.document_type ?? ""} onChange={(event) => setField("document_type", event.target.value)}><option>NIT</option><option>CC</option><option>CE</option><option>Otro</option></select></label><label className="text-sm font-semibold">Número<input disabled={!canEdit} className={inputClass} value={settings.document_number ?? ""} onChange={(event) => setField("document_number", event.target.value)} /></label></div>
          <label className="text-sm font-semibold">Dirección<input disabled={!canEdit} className={inputClass} value={settings.address ?? ""} onChange={(event) => setField("address", event.target.value)} /></label>
          <label className="text-sm font-semibold">Teléfono<input disabled={!canEdit} className={inputClass} value={settings.phone ?? ""} onChange={(event) => setField("phone", event.target.value)} /></label>
          <label className="text-sm font-semibold sm:col-start-2">Correo electrónico<input type="email" disabled={!canEdit} className={inputClass} value={settings.email ?? ""} onChange={(event) => setField("email", event.target.value)} /></label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Landmark size={18} className="text-[#f97316]" />Información para pagos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Banco<input disabled={!canEdit} className={inputClass} value={settings.bank_name ?? ""} onChange={(event) => setField("bank_name", event.target.value)} /></label>
          <label className="text-sm font-semibold">Tipo de cuenta<input disabled={!canEdit} className={inputClass} value={settings.account_type ?? ""} onChange={(event) => setField("account_type", event.target.value)} placeholder="Ahorros, corriente…" /></label>
          <label className="text-sm font-semibold">Número de cuenta<input disabled={!canEdit} className={inputClass} value={settings.account_number ?? ""} onChange={(event) => setField("account_number", event.target.value)} /></label>
          <label className="text-sm font-semibold">Titular<input disabled={!canEdit} className={inputClass} value={settings.account_holder ?? ""} onChange={(event) => setField("account_holder", event.target.value)} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Instrucciones de pago<textarea disabled={!canEdit} rows={3} className={inputClass} value={settings.payment_instructions ?? ""} onChange={(event) => setField("payment_instructions", event.target.value)} placeholder="Referencia, Nequi, instrucciones adicionales…" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Condiciones o texto legal<textarea disabled={!canEdit} rows={3} className={inputClass} value={settings.invoice_terms ?? ""} onChange={(event) => setField("invoice_terms", event.target.value)} placeholder="Condiciones de pago, garantía u observaciones generales…" /></label>
        </div>
      </section>

      {canEdit && <div className="flex justify-end"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}Guardar configuración</button></div>}
    </form>
  </div>;
}
