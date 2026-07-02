import { supabase } from "../../lib/supabase";

export type ManagedUserRole = "admin" | "technician" | "billing";

export async function createManagedUser(input: { fullName: string; email: string; password: string; role: ManagedUserRole }) {
  const { error } = await supabase.functions.invoke("admin-create-user", { body: input });
  if (error) throw new Error(error.message || "No fue posible crear el usuario.");
}

export async function deleteManagedUser(userId: string, reason: string) {
  const { error } = await supabase.rpc("delete_unused_user", { p_user_id: userId, p_reason: reason });
  if (error) throw error;
}
