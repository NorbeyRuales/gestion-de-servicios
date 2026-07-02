import type { ReactNode } from "react";
import { PanelsTopLeft, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface StyledModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function StyledModal({ title, children, onClose }: StyledModalProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-card shadow-[0_30px_90px_-24px_rgba(15,23,42,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200">
          <header className="relative flex shrink-0 items-center gap-3 border-b border-border/80 bg-gradient-to-r from-slate-50 via-white to-orange-50/70 px-5 py-4 pr-16">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1a3558] text-white shadow-sm ring-4 ring-white">
              <PanelsTopLeft size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f97316]">Gestión</p>
              <DialogPrimitive.Title className="truncate text-lg font-bold tracking-tight text-foreground">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close className="absolute right-5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border/80 bg-white/90 text-muted-foreground shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-200" aria-label="Cerrar">
              <X size={17} />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 overflow-y-auto bg-card">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
