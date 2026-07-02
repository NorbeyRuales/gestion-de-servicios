const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function validatePaymentProof(file: File) {
  if (!allowedTypes.has(file.type)) throw new Error("El comprobante debe ser una imagen JPG, PNG, WEBP o un archivo PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("El comprobante no puede superar 10 MB.");
}
