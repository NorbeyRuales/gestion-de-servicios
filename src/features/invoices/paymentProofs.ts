import { supabase } from "../../lib/supabase";
export { validatePaymentProof } from "./paymentProofValidation";
import { validatePaymentProof } from "./paymentProofValidation";

export interface PaymentProof {
  id: string;
  payment_id: string;
  file_path: string;
  created_at: string;
}

function extensionFor(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function uploadFile(invoiceId: string, paymentId: string, file: File) {
  validatePaymentProof(file);
  const path = `${invoiceId}/${paymentId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function createPaymentProof(invoiceId: string, paymentId: string, file: File) {
  const path = await uploadFile(invoiceId, paymentId, file);
  const { data, error } = await supabase.from("payment_proofs").insert({ payment_id: paymentId, file_path: path }).select("id,payment_id,file_path,created_at").single();
  if (error) {
    await supabase.storage.from("payment-proofs").remove([path]);
    throw error;
  }
  return data as PaymentProof;
}

export async function replacePaymentProof(invoiceId: string, proof: PaymentProof, file: File) {
  const path = await uploadFile(invoiceId, proof.payment_id, file);
  const { data, error } = await supabase.from("payment_proofs").update({ file_path: path }).eq("id", proof.id).select("id,payment_id,file_path,created_at").single();
  if (error) {
    await supabase.storage.from("payment-proofs").remove([path]);
    throw error;
  }
  await supabase.storage.from("payment-proofs").remove([proof.file_path]);
  return data as PaymentProof;
}

export async function deletePaymentProof(proof: PaymentProof) {
  const { error } = await supabase.from("payment_proofs").delete().eq("id", proof.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from("payment-proofs").remove([proof.file_path]);
  if (storageError) throw new Error(`El registro fue eliminado, pero no se pudo limpiar el archivo: ${storageError.message}`);
}

export async function getPaymentProofUrl(path: string) {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo abrir el comprobante.");
  return data.signedUrl;
}
