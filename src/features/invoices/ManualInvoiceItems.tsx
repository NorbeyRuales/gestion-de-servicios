import { Plus, Trash2 } from "lucide-react";

export type ManualItemType = "material" | "spare_part" | "labor" | "transport" | "rental" | "other";

export interface ManualInvoiceItem {
  id: string;
  item_type: ManualItemType;
  description: string;
  quantity: number;
  unit_price: number;
}

interface ManualInvoiceItemsProps {
  items: ManualInvoiceItem[];
  onChange: (items: ManualInvoiceItem[]) => void;
}

const inputClass = "w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const itemLabels: Record<ManualItemType, string> = { material: "Material", spare_part: "Repuesto", labor: "Mano de obra", transport: "Transporte", rental: "Alquiler", other: "Otro" };

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export function createEmptyManualItem(): ManualInvoiceItem {
  return { id: crypto.randomUUID(), item_type: "labor", description: "", quantity: 1, unit_price: 0 };
}

export function ManualInvoiceItems({ items, onChange }: ManualInvoiceItemsProps) {
  const update = (id: string, changes: Partial<ManualInvoiceItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item));

  return <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-bold">Conceptos de la factura manual</h2><p className="text-sm text-muted-foreground">Agrega los trabajos y gastos realizados durante el período que vas a cobrar.</p></div><button type="button" onClick={() => onChange([...items, createEmptyManualItem()])} className="flex items-center gap-1 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Agregar concepto</button></div>
    <div className="space-y-3 p-4">
      {items.map((item) => <article key={item.id} className="grid items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-[150px_1fr_100px_150px_120px_40px]">
        <label className="text-xs font-semibold">Tipo<select className={`${inputClass} mt-1`} value={item.item_type} onChange={(event) => update(item.id, { item_type: event.target.value as ManualItemType })}>{Object.entries(itemLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-semibold sm:col-span-2 lg:col-span-1">Descripción<input className={`${inputClass} mt-1`} value={item.description} onChange={(event) => update(item.id, { description: event.target.value })} placeholder="Ej. Mantenimiento semanal de estufas" /></label>
        <label className="text-xs font-semibold">Cantidad<input type="number" min="0.01" step="0.01" className={`${inputClass} mt-1`} value={item.quantity} onChange={(event) => update(item.id, { quantity: Number(event.target.value) })} /></label>
        <label className="text-xs font-semibold">Valor unitario<input type="number" min="0" step="1" className={`${inputClass} mt-1`} value={item.unit_price} onChange={(event) => update(item.id, { unit_price: Number(event.target.value) })} /></label>
        <div className="pb-2 text-right text-xs"><span className="block text-muted-foreground">Subtotal</span><strong className="font-mono">{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong></div>
        <button type="button" disabled={items.length === 1} onClick={() => onChange(items.filter((current) => current.id !== item.id))} aria-label="Eliminar concepto" className="grid h-10 w-10 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={15} /></button>
      </article>)}
    </div>
  </section>;
}
