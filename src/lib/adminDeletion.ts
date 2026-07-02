import { supabase } from "./supabase";
import { requestDeletionReason } from "../app/components/ui/destructive-dialog";

export type DeletableEntity = "client" | "branch" | "area" | "asset" | "service_type" | "work_order";

function messageFrom(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.replace(/^.*?: /, "");
  }
  return "No fue posible eliminar el registro.";
}

export async function requestControlledDeletion(entity: DeletableEntity, id: string, label: string) {
  const reason = await requestDeletionReason(label);
  if (reason === null) return false;

  const { error } = await supabase.rpc("delete_unused_record", {
    p_entity: entity,
    p_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(messageFrom(error));
  return true;
}
