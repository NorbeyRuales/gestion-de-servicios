import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function ToastFeedback({ error, success }: { error?: string; success?: string }) {
  const lastError = useRef("");
  const lastSuccess = useRef("");

  useEffect(() => {
    if (!error) { lastError.current = ""; return; }
    if (lastError.current === error) return;
    lastError.current = error;
    toast.error("No se pudo completar la acción", { description: error, duration: 7000 });
  }, [error]);

  useEffect(() => {
    if (!success) { lastSuccess.current = ""; return; }
    if (lastSuccess.current === success) return;
    lastSuccess.current = success;
    toast.success("Acción completada", { description: success, duration: 4500 });
  }, [success]);

  return null;
}
