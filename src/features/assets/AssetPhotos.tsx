import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Camera, Image, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { confirmDestructiveAction } from "../../app/components/ui/destructive-dialog";
import { PhotoCaptionEditor } from "../../components/PhotoCaptionEditor";
import { ToastFeedback } from "../../components/ToastFeedback";

interface AssetPhoto {
  id: string;
  asset_id: string;
  file_path: string;
  caption: string | null;
  created_at: string;
}

interface PhotoWithUrl extends AssetPhoto {
  signedUrl: string;
}

const bucket = "asset-photos";
const inputClass = "w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";

function messageFrom(error: unknown) {
  if (!error) return "No fue posible completar la operación.";
  const message = error instanceof Error
    ? error.message
    : typeof error === "object"
      ? "message" in error && typeof error.message === "string"
        ? error.message
        : "details" in error && typeof error.details === "string"
          ? error.details
          : "hint" in error && typeof error.hint === "string"
            ? error.hint
            : JSON.stringify(error)
      : String(error);

  if (message.includes("mime type")) return "Solo se permiten imágenes JPG, PNG o WEBP.";
  if (message.includes("row-level security")) return "No tienes permiso para gestionar fotos.";
  return message.replace(/^.*?: /, "") || "No fue posible completar la operación.";
}

function safeFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "") || "jpg"}`;
}

function localDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function Feedback({ error, success }: { error: string; success: string }) {
  return <ToastFeedback error={error} success={success} />;
}

export function AssetPhotos({ assetId, assetName, disabled = false }: { assetId: string; assetName: string; disabled?: boolean }) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("asset_photos")
      .select("id,asset_id,file_path,caption,created_at")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(messageFrom(queryError));
      setLoading(false);
      return;
    }

    const records = (data ?? []) as AssetPhoto[];
    const withUrls = await Promise.all(records.map(async (photo) => {
      const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(photo.file_path, 60 * 60);
      return { ...photo, signedUrl: signedError ? "" : signed.signedUrl };
    }));

    setPhotos(withUrls);
    setLoading(false);
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!file) return setError("Selecciona una foto para subir.");
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return setError("Solo se permiten imágenes JPG, PNG o WEBP.");
    if (file.size > 10 * 1024 * 1024) return setError("La imagen no puede superar 10 MB.");

    setSaving(true);
    const path = `${assetId}/${safeFileName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return setError(messageFrom(uploadError));

      const { error: insertError } = await supabase.from("asset_photos").insert({
        asset_id: assetId,
        file_path: path,
        caption: caption.trim() || null,
      });

      if (insertError) {
        await supabase.storage.from(bucket).remove([path]);
        return setError(messageFrom(insertError));
      }

      setFile(null);
      setCaption("");
      setSuccess("Foto subida correctamente.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (photo: PhotoWithUrl) => {
    if (!await confirmDestructiveAction({ title: "Eliminar foto del equipo", description: "La imagen se eliminará definitivamente del historial del equipo.", confirmLabel: "Sí, eliminar" })) return;
    setError("");
    setSuccess("");
    setDeletingId(photo.id);
    try {
      const { error: storageError } = await supabase.storage.from(bucket).remove([photo.file_path]);
      if (storageError) return setError(messageFrom(storageError));

      const { error: deleteError } = await supabase.from("asset_photos").delete().eq("id", photo.id);
      if (deleteError) return setError(messageFrom(deleteError));

      setSuccess("Foto eliminada.");
      await load();
    } finally {
      setDeletingId("");
    }
  };

  return <div className="p-5 space-y-4">
    <div>
      <h3 className="font-bold flex items-center gap-2"><Camera size={18} className="text-[#f97316]" />Fotos del equipo</h3>
      <p className="text-sm text-muted-foreground mt-1">{assetName} · JPG, PNG o WEBP hasta 10 MB.</p>
    </div>

    <Feedback error={error} success={success} />

    {!disabled && <form onSubmit={submit} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end rounded-xl border border-dashed border-border p-4">
      <label className="text-sm font-semibold">Foto
        <input type="file" accept="image/jpeg,image/png,image/webp" className={`${inputClass} mt-1.5`} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <label className="text-sm font-semibold">Descripción
        <input className={`${inputClass} mt-1.5`} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Ej. Placa serial, estado actual, daño visible" />
      </label>
      <button disabled={saving} className="h-11 rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        Subir
      </button>
    </form>}

    {loading ? <div className="py-12 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div> : photos.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      <Image className="mx-auto mb-2" />
      Este equipo aún no tiene fotos.
    </div> : <div className="grid sm:grid-cols-2 gap-3">
      {photos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-xl border border-border bg-background">
        {photo.signedUrl ? <a href={photo.signedUrl} target="_blank" rel="noreferrer" className="block">
          <img src={photo.signedUrl} alt={photo.caption || `Foto de ${assetName}`} className="h-44 w-full object-cover bg-muted" />
        </a> : <div className="h-44 w-full bg-muted grid place-items-center text-muted-foreground"><Image /></div>}
        <div className="p-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {editingId === photo.id ? <PhotoCaptionEditor table="asset_photos" photoId={photo.id} initialCaption={photo.caption} onCancel={() => setEditingId("")} onError={(captionError) => setError(messageFrom(new Error(captionError)))} onSaved={async () => { setEditingId(""); setSuccess("Descripción actualizada."); await load(); }} /> : <p className="text-sm font-medium">{photo.caption || "Sin descripción"}</p>}
            <p className="text-xs text-muted-foreground">{localDateTime(photo.created_at)}</p>
          </div>
          {!disabled && editingId !== photo.id && <div className="flex"><button type="button" onClick={() => setEditingId(photo.id)} className="grid h-8 w-8 place-items-center rounded-md text-blue-700 hover:bg-blue-50" aria-label="Editar descripción"><Pencil size={14} /></button><button type="button" onClick={() => void remove(photo)} disabled={deletingId === photo.id} className="h-8 w-8 rounded-md text-red-500 hover:bg-red-50 grid place-items-center disabled:opacity-60" aria-label="Eliminar foto">
            {deletingId === photo.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button></div>}
        </div>
      </article>)}
    </div>}
  </div>;
}
