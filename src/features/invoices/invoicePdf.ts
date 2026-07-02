import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../lib/supabase";

type InvoiceStatus = "pending" | "partial" | "paid" | "void";
type PaymentMethod = "cash" | "bank_transfer" | "nequi" | "bancolombia" | "daviplata" | "other";

export interface GeneratedInvoicePdf {
  blob: Blob;
  fileName: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  grandTotal: number;
  paidTotal: number;
  balanceTotal: number;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_id: string;
  billing_branch_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  materials_total: number;
  spare_parts_total: number;
  labor_total: number;
  transport_total: number;
  other_total: number;
  discount_total: number;
  grand_total: number;
  notes: string | null;
}

interface CompanyData {
  business_name: string;
  document_type: string | null;
  document_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  payment_instructions: string | null;
  invoice_terms: string | null;
}

const statusLabels: Record<InvoiceStatus, string> = { pending: "Pendiente", partial: "Pago parcial", paid: "Pagada", void: "Anulada" };
const methodLabels: Record<PaymentMethod, string> = { cash: "Efectivo", bank_transfer: "Transferencia", nequi: "Nequi", bancolombia: "Bancolombia", daviplata: "Daviplata", other: "Otro" };
const itemLabels: Record<string, string> = { material: "Material", spare_part: "Repuesto", labor: "Mano de obra", transport: "Transporte", rental: "Alquiler", other: "Otro" };

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ");
}

function date(value?: string | null) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function queryError(error: { message?: string; details?: string } | null, fallback: string) {
  if (!error) return new Error(fallback);
  return new Error(error.message || error.details || fallback);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el logo."));
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePdf(invoiceId: string): Promise<GeneratedInvoicePdf> {
  const { data: invoiceRaw, error: invoiceError } = await supabase
    .from("invoices")
    .select("id,invoice_number,client_id,billing_branch_id,issue_date,due_date,status,materials_total,spare_parts_total,labor_total,transport_total,other_total,discount_total,grand_total,notes")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoiceRaw) throw queryError(invoiceError, "No se encontró la factura.");
  const invoice = invoiceRaw as InvoiceData;

  const [clientResult, linksResult, manualItemsResult, paymentsResult, companyResult] = await Promise.all([
    supabase.from("clients").select("name,document_type,document_number,phone,email,billing_address").eq("id", invoice.client_id).single(),
    supabase.from("invoice_work_orders").select("work_order_id").eq("invoice_id", invoice.id),
    supabase.from("invoice_line_items").select("item_type,description,quantity,unit_price,subtotal").eq("invoice_id", invoice.id).order("created_at"),
    supabase.from("payments").select("payment_date,amount,payment_method,received_at_branch_id,reference,notes").eq("invoice_id", invoice.id).order("payment_date"),
    supabase.from("company_settings").select("business_name,document_type,document_number,address,phone,email,logo_path,bank_name,account_type,account_number,account_holder,payment_instructions,invoice_terms").eq("id", 1).single(),
  ]);
  if (clientResult.error) throw queryError(clientResult.error, "No se pudo cargar el cliente.");
  if (linksResult.error) throw queryError(linksResult.error, "No se pudieron cargar las órdenes.");
  if (manualItemsResult.error) throw queryError(manualItemsResult.error, "No se pudieron cargar los conceptos manuales.");
  if (paymentsResult.error) throw queryError(paymentsResult.error, "No se pudieron cargar los pagos.");
  if (companyResult.error) throw queryError(companyResult.error, "No se pudo cargar la configuración de la empresa.");

  const orderIds = (linksResult.data ?? []).map((link) => link.work_order_id as string);
  const [ordersResult, itemsResult] = orderIds.length > 0 ? await Promise.all([
    supabase.from("work_orders").select("id,code,execution_branch_id,completion_date,reported_problem,work_performed").in("id", orderIds).order("code"),
    supabase.from("work_order_items").select("work_order_id,item_type,description,quantity,unit_price,subtotal").in("work_order_id", orderIds).order("created_at"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (ordersResult.error) throw queryError(ordersResult.error, "No se pudo cargar el detalle de las órdenes.");
  if (itemsResult.error) throw queryError(itemsResult.error, "No se pudieron cargar los conceptos facturados.");

  const orders = ordersResult.data ?? [];
  const branchIds = Array.from(new Set([invoice.billing_branch_id, ...orders.map((order) => order.execution_branch_id)].filter(Boolean))) as string[];
  const branchesResult = branchIds.length > 0
    ? await supabase.from("branches").select("id,name,address").in("id", branchIds)
    : { data: [], error: null };
  if (branchesResult.error) throw queryError(branchesResult.error, "No se pudieron cargar las sedes.");

  const client = clientResult.data;
  const company = companyResult.data as CompanyData;
  const payments = paymentsResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const items = itemsResult.data ?? [];
  const manualItems = manualItemsResult.data ?? [];
  const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name ?? "Sin sede";
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(Number(invoice.grand_total) - paid, 0);
  let logoDataUrl = "";
  if (company.logo_path) {
    const { data: logoBlob } = await supabase.storage.from("company-assets").download(company.logo_path);
    if (logoBlob) logoDataUrl = await blobToDataUrl(logoBlob);
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 53, 88);
  doc.rect(0, 0, pageWidth, 42, "F");
  let companyTextX = 14;
  if (logoDataUrl && company.logo_path) {
    const format = company.logo_path.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
    const image = doc.getImageProperties(logoDataUrl);
    const ratio = Math.min(26 / image.width, 26 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    doc.addImage(logoDataUrl, format, 14, 7, width, height, undefined, "FAST");
    companyTextX = 44;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company.business_name.toUpperCase(), companyTextX, 13);
  doc.setFontSize(10);
  doc.text("FACTURA INTERNA / CUENTA DE COBRO", companyTextX, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const companyDocument = [company.document_type, company.document_number].filter(Boolean).join(" ");
  if (companyDocument) doc.text(companyDocument, companyTextX, 28);
  const companyContact = [company.phone, company.email].filter(Boolean).join(" · ");
  if (companyContact) doc.text(companyContact, companyTextX, 34);
  if (company.address) doc.text(company.address, companyTextX, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(invoice.invoice_number, pageWidth - 14, 14, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Estado: ${statusLabels[invoice.status]}`, pageWidth - 14, 22, { align: "right" });

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Documento interno. No corresponde a facturación electrónica DIAN.", 14, 49);

  autoTable(doc, {
    startY: 55,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.7 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 36 }, 1: { cellWidth: 60 }, 2: { fontStyle: "bold", textColor: [71, 85, 105], cellWidth: 28 } },
    body: [
      ["Cliente", client.name, "Emisión", date(invoice.issue_date)],
      ["Documento", [client.document_type, client.document_number].filter(Boolean).join(" ") || "Sin documento", "Vencimiento", date(invoice.due_date)],
      ["Contacto", [client.phone, client.email].filter(Boolean).join(" · ") || "Sin contacto", "Sede de cobro", branchName(invoice.billing_branch_id)],
      ["Dirección", client.billing_address || "Sin dirección de facturación", "Estado", statusLabels[invoice.status]],
    ],
  });

  let currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalle de trabajos y conceptos", 14, currentY);

  const detailRows = orders.flatMap((order) => {
    const orderItems = items.filter((item) => item.work_order_id === order.id);
    if (orderItems.length === 0) return [[order.code, branchName(order.execution_branch_id), order.work_performed || order.reported_problem || "Servicio", "Servicio", "1", money(0), money(0)]];
    return orderItems.map((item) => [
      order.code,
      branchName(order.execution_branch_id),
      item.description,
      itemLabels[item.item_type] ?? item.item_type,
      Number(item.quantity).toLocaleString("es-CO"),
      money(Number(item.unit_price)),
      money(Number(item.subtotal)),
    ]);
  });
  detailRows.push(...manualItems.map((item) => [
    "Manual",
    branchName(invoice.billing_branch_id),
    item.description,
    itemLabels[item.item_type] ?? item.item_type,
    Number(item.quantity).toLocaleString("es-CO"),
    money(Number(item.unit_price)),
    money(Number(item.subtotal)),
  ]));

  autoTable(doc, {
    startY: currentY + 3,
    head: [["Orden", "Sede ejecución", "Concepto", "Tipo", "Cant.", "Valor unit.", "Subtotal"]],
    body: detailRows,
    theme: "grid",
    headStyles: { fillColor: [26, 53, 88], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 27 }, 2: { cellWidth: 50 }, 3: { cellWidth: 24 }, 4: { halign: "right", cellWidth: 13 }, 5: { halign: "right", cellWidth: 25 }, 6: { halign: "right", cellWidth: 27 } },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Página ${page}`, pageWidth - 14, 289, { align: "right" });
    },
  });

  currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  autoTable(doc, {
    startY: currentY,
    margin: { left: 112 },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    body: [
      ["Materiales", money(Number(invoice.materials_total))],
      ["Repuestos", money(Number(invoice.spare_parts_total))],
      ["Mano de obra", money(Number(invoice.labor_total))],
      ["Transporte", money(Number(invoice.transport_total))],
      ["Otros", money(Number(invoice.other_total))],
      ["Descuento", `-${money(Number(invoice.discount_total))}`],
      [{ content: "TOTAL", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }, { content: money(Number(invoice.grand_total)), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } }],
      ["Pagado", money(paid)],
      [{ content: "SALDO", styles: { fontStyle: "bold", textColor: [185, 28, 28] } }, { content: money(balance), styles: { fontStyle: "bold", halign: "right", textColor: [185, 28, 28] } }],
    ],
  });

  if (payments.length > 0) {
    currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Pagos registrados", 14, currentY);
    autoTable(doc, {
      startY: currentY + 3,
      head: [["Fecha", "Método", "Referencia", "Valor"]],
      body: payments.map((payment) => [date(payment.payment_date), methodLabels[payment.payment_method as PaymentMethod], payment.reference || "—", money(Number(payment.amount))]),
      theme: "striped",
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: "right" } },
    });
  }

  currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  const addTextSection = (title: string, content: string) => {
    const lines = doc.splitTextToSize(content, 180) as string[];
    const requiredHeight = 8 + lines.length * 4;
    if (currentY + requiredHeight > 278) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 14, currentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lines, 14, currentY + 5);
    currentY += requiredHeight;
  };

  if (invoice.notes) addTextSection("Observaciones", invoice.notes);
  const bankDetails = [company.bank_name, company.account_type, company.account_number, company.account_holder ? `Titular: ${company.account_holder}` : ""].filter(Boolean).join(" · ");
  const paymentText = [bankDetails, company.payment_instructions].filter(Boolean).join("\n");
  if (paymentText) addTextSection("Información para el pago", paymentText);
  if (company.invoice_terms) addTextSection("Condiciones", company.invoice_terms);

  const fileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
  return {
    blob: doc.output("blob"),
    fileName,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    grandTotal: Number(invoice.grand_total),
    paidTotal: paid,
    balanceTotal: balance,
  };
}

export function savePdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadInvoicePdf(invoiceId: string) {
  const generated = await generateInvoicePdf(invoiceId);
  savePdfBlob(generated.blob, generated.fileName);
}
