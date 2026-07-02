import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { supabase } from "../lib/supabase";

interface PhotoCaptionEditorProps {
  table: "asset_photos" | "work_order_photos";
  photoId: string;
  initialCaption: string | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}

export function PhotoCaptionEditor({ table, photoId, initialCaption, onCancel, onSaved, onError }: PhotoCaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from(table).update({ caption: caption.trim() || null }).eq("id", photoId);
    if (error) onError(error.message); else await onSaved();
    setSaving(false);
  };

  return <form onSubmit={(event) => void save(event)} className="mt-2 flex items-center gap-2">
    <input autoFocus className="min-w-0 flex-1 rounded-lg border border-border bg-input-background px-2.5 py-1.5 text-xs outline-none focus:border-[#f97316]" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Descripción de la foto" />
    <button type="submit" disabled={saving} aria-label="Guardar descripción" className="grid h-8 w-8 place-items-center rounded-md bg-[#1a3558] text-white disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}</button>
    <button type="button" onClick={onCancel} aria-label="Cancelar edición" className="grid h-8 w-8 place-items-center rounded-md border border-border"><X size={13} /></button>
  </form>;
}
