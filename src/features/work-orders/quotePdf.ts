import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../lib/supabase";

const itemLabels: Record<string, string> = { material: "Material", spare_part: "Repuesto", labor: "Mano de obra", transport: "Transporte", rental: "Alquiler", other: "Otro" };

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ");
}

function shortDate(value: Date) {
  return value.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el logo."));
    reader.readAsDataURL(blob);
  });
}

export async function exportQuotePdf(orderId: string) {
  const [orderResult, companyResult] = await Promise.all([
    supabase.from("work_orders").select("code,client_id,reported_problem,work_performed,observations,clients(name,document_type,document_number,phone,email,billing_address),branches(name,address),service_types(name),work_order_items(item_type,description,quantity,unit_price,subtotal)").eq("id", orderId).single(),
    supabase.from("company_settings").select("business_name,document_type,document_number,address,phone,email,logo_path,invoice_terms").eq("id", 1).single(),
  ]);
  if (orderResult.error || !orderResult.data) throw orderResult.error ?? new Error("No se encontró la orden.");
  if (companyResult.error || !companyResult.data) throw companyResult.error ?? new Error("No se encontró la configuración de la empresa.");

  const order = orderResult.data as unknown as {
    code: string; reported_problem: string | null; work_performed: string | null; observations: string | null;
    clients: { name: string; document_type: string | null; document_number: string | null; phone: string | null; email: string | null; billing_address: string | null } | null;
    branches: { name: string; address: string | null } | null; service_types: { name: string } | null;
    work_order_items: { item_type: string; description: string; quantity: number; unit_price: number; subtotal: number }[];
  };
  const company = companyResult.data;
  let logoDataUrl = "";
  if (company.logo_path) {
    const { data } = await supabase.storage.from("company-assets").download(company.logo_path);
    if (data) logoDataUrl = await blobToDataUrl(data);
  }

  const issuedAt = new Date();
  const validUntil = new Date(issuedAt);
  validUntil.setDate(validUntil.getDate() + 15);
  const total = order.work_order_items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 53, 88);
  doc.rect(0, 0, pageWidth, 42, "F");
  let companyX = 14;
  if (logoDataUrl && company.logo_path) {
    const format = company.logo_path.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
    const image = doc.getImageProperties(logoDataUrl);
    const ratio = Math.min(26 / image.width, 26 / image.height);
    doc.addImage(logoDataUrl, format, 14, 7, image.width * ratio, image.height * ratio, undefined, "FAST");
    companyX = 44;
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company.business_name.toUpperCase(), companyX, 13);
  doc.setFontSize(11);
  doc.text("COTIZACIÓN DE SERVICIOS", companyX, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const companyDocument = [company.document_type, company.document_number].filter(Boolean).join(" ");
  if (companyDocument) doc.text(companyDocument, companyX, 28);
  const contact = [company.phone, company.email].filter(Boolean).join(" · ");
  if (contact) doc.text(contact, companyX, 34);
  if (company.address) doc.text(company.address, companyX, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(order.code, pageWidth - 14, 15, { align: "right" });
  doc.setFontSize(8.5);
  doc.text(`Emisión: ${shortDate(issuedAt)}`, pageWidth - 14, 24, { align: "right" });
  doc.text(`Válida hasta: ${shortDate(validUntil)}`, pageWidth - 14, 31, { align: "right" });
  doc.setTextColor(31, 41, 55);

  autoTable(doc, {
    startY: 50,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 32 }, 1: { cellWidth: 62 }, 2: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 30 } },
    body: [
      ["Cliente", order.clients?.name || "Cliente", "Documento", [order.clients?.document_type, order.clients?.document_number].filter(Boolean).join(" ") || "Sin documento"],
      ["Contacto", [order.clients?.phone, order.clients?.email].filter(Boolean).join(" · ") || "Sin contacto", "Sede", order.branches?.name || "Sin sede"],
      ["Dirección", order.clients?.billing_address || order.branches?.address || "Sin dirección", "Servicio", order.service_types?.name || "Servicio"],
    ],
  });
  let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Alcance solicitado", 14, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const scope = order.reported_problem || order.work_performed || "Servicio según orden de trabajo.";
  const scopeLines = doc.splitTextToSize(scope, pageWidth - 28) as string[];
  doc.text(scopeLines, 14, y + 5);
  y += 8 + scopeLines.length * 4;

  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Descripción", "Cantidad", "Valor unitario", "Subtotal"]],
    body: order.work_order_items.length ? order.work_order_items.map((item) => [itemLabels[item.item_type] || item.item_type, item.description, Number(item.quantity).toLocaleString("es-CO"), money(Number(item.unit_price)), money(Number(item.subtotal))]) : [["Servicio", scope, "1", money(0), money(0)]],
    foot: [[{ content: "TOTAL COTIZADO", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } }, { content: money(total), styles: { halign: "right", fontStyle: "bold" } }]],
    theme: "grid",
    headStyles: { fillColor: [26, 53, 88], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [249, 115, 22], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 75 }, 2: { halign: "right", cellWidth: 19 }, 3: { halign: "right", cellWidth: 31 }, 4: { halign: "right", cellWidth: 31 } },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Condiciones comerciales", 14, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const terms = company.invoice_terms || "Vigencia: 15 días calendario. Los trabajos adicionales no incluidos requieren aprobación previa del cliente.";
  doc.text(doc.splitTextToSize(terms, pageWidth - 28) as string[], 14, y + 5);
  if (order.observations) {
    const observationY = y + 13 + (doc.splitTextToSize(terms, pageWidth - 28) as string[]).length * 3;
    doc.setFont("helvetica", "bold"); doc.text("Observaciones", 14, observationY);
    doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(order.observations, pageWidth - 28) as string[], 14, observationY + 5);
  }
  doc.save(`cotizacion-${order.code}.pdf`);
}
