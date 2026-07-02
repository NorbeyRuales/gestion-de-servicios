import { supabase } from "./supabase";

export type DeletableEntity = "client" | "branch" | "area" | "asset" | "service_type" | "work_order";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.replace(/^.*?: /, "");
  }
  return "No fue posible eliminar el registro.";
}

export async function requestControlledDeletion(entity: DeletableEntity, id: string, label: string) {
  const reason = window.prompt(`Motivo para eliminar "${label}" (mínimo 5 caracteres):`);
  if (reason === null) return false;
  if (reason.trim().length < 5) throw new Error("Debes escribir un motivo de al menos 5 caracteres.");
  if (!window.confirm(`¿Eliminar definitivamente "${label}"? Esta acción no se puede deshacer.`)) return false;

  const { error } = await supabase.rpc("delete_unused_record", {
    p_entity: entity,
    p_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(messageFrom(error));
  return true;
}
