export interface ReportInvoiceRow {
  number: string;
  client: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  paid: number;
  balance: number;
}

export interface ReportServiceRow {
  code: string;
  client: string;
  branch: string;
  serviceType: string;
  date: string;
  status: string;
  total: number;
}

export interface ReportClientRow {
  client: string;
  invoices: number;
  billed: number;
  paid: number;
  balance: number;
}

export interface ReportExportData {
  companyName: string;
  from: string;
  to: string;
  billed: number;
  collected: number;
  receivables: number;
  services: number;
  invoices: ReportInvoiceRow[];
  servicesDetail: ReportServiceRow[];
  clients: ReportClientRow[];
}

const headerStyle = { backgroundColor: "#1A3558", color: "#FFFFFF", fontWeight: "bold" as const, align: "center" as const, wrap: true };
const titleStyle = { backgroundColor: "#F97316", color: "#FFFFFF", fontWeight: "bold" as const, align: "center" as const };
const currencyFormat = "$#,##0;[Red]($#,##0);-";

function textCell(value: string, extra: Record<string, unknown> = {}) {
  return { value, type: String, ...extra };
}

function numberCell(value: number, extra: Record<string, unknown> = {}) {
  return { value, type: Number, format: currencyFormat, align: "right" as const, ...extra };
}

export async function exportReportExcel(data: ReportExportData) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const summary = [
    [textCell(`${data.companyName} — REPORTE DE GESTIÓN`, { ...titleStyle, span: 4 })],
    [textCell("Período", { fontWeight: "bold" }), textCell(`${data.from} a ${data.to}`), textCell("Generado", { fontWeight: "bold" }), textCell(new Date().toLocaleString("es-CO"))],
    [textCell("Indicador", headerStyle), textCell("Valor", headerStyle), textCell("Unidad", headerStyle), textCell("Descripción", headerStyle)],
    [textCell("Facturado"), numberCell(data.billed), textCell("COP"), textCell("Facturas emitidas en el período")],
    [textCell("Recaudado"), numberCell(data.collected), textCell("COP"), textCell("Pagos recibidos en el período")],
    [textCell("Saldo por cobrar"), numberCell(data.receivables), textCell("COP"), textCell("Saldo de las facturas del período")],
    [textCell("Servicios realizados"), { value: data.services, type: Number, align: "right" as const }, textCell("Órdenes"), textCell("Órdenes terminadas o facturadas")],
  ];

  const invoices = [
    [textCell("FACTURAS", { ...titleStyle, span: 8 })],
    ["Número", "Cliente", "Emisión", "Vencimiento", "Estado", "Total", "Pagado", "Saldo"].map((value) => textCell(value, headerStyle)),
    ...data.invoices.map((invoice) => [
      textCell(invoice.number), textCell(invoice.client), textCell(invoice.issueDate), textCell(invoice.dueDate), textCell(invoice.status),
      numberCell(invoice.total), numberCell(invoice.paid), numberCell(invoice.balance),
    ]),
  ];

  const services = [
    [textCell("SERVICIOS", { ...titleStyle, span: 7 })],
    ["Orden", "Cliente", "Sede", "Tipo de servicio", "Fecha", "Estado", "Total"].map((value) => textCell(value, headerStyle)),
    ...data.servicesDetail.map((service) => [
      textCell(service.code), textCell(service.client), textCell(service.branch), textCell(service.serviceType), textCell(service.date), textCell(service.status), numberCell(service.total),
    ]),
  ];

  const clients = [
    [textCell("RESUMEN POR CLIENTE", { ...titleStyle, span: 5 })],
    ["Cliente", "Facturas", "Facturado", "Pagado", "Saldo"].map((value) => textCell(value, headerStyle)),
    ...data.clients.map((client) => [textCell(client.client), { value: client.invoices, type: Number, align: "right" as const }, numberCell(client.billed), numberCell(client.paid), numberCell(client.balance)]),
  ];

  const workbook = writeXlsxFile([
    { data: summary, sheet: "Resumen", showGridLines: false, columns: [{ width: 24 }, { width: 22 }, { width: 16 }, { width: 42 }] },
    { data: invoices, sheet: "Facturas", showGridLines: false, columns: [{ width: 18 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }] },
    { data: services, sheet: "Servicios", showGridLines: false, columns: [{ width: 18 }, { width: 30 }, { width: 24 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 16 }] },
    { data: clients, sheet: "Clientes", showGridLines: false, columns: [{ width: 34 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }] },
  ]);
  await workbook.toFile(`reporte-${data.from}-${data.to}.xlsx`);
}

export async function exportReportPdf(data: ReportExportData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 53, 88);
  doc.rect(0, 0, width, 32, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(data.companyName.toUpperCase(), 14, 13);
  doc.setFontSize(11);
  doc.text("REPORTE DE GESTIÓN", 14, 21);
  doc.setFontSize(9);
  doc.text(`${data.from} a ${data.to}`, width - 14, 13, { align: "right" });
  doc.setTextColor(31, 41, 55);

  autoTable(doc, {
    startY: 40,
    head: [["Facturado", "Recaudado", "Por cobrar", "Servicios"]],
    body: [[money(data.billed), money(data.collected), money(data.receivables), String(data.services)]],
    theme: "grid",
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    bodyStyles: { fontStyle: "bold", halign: "right" },
  });
  let y = (doc as JsPdfDocument & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Facturas del período", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Número", "Cliente", "Emisión", "Estado", "Total", "Pagado", "Saldo"]],
    body: data.invoices.map((invoice) => [invoice.number, invoice.client, invoice.issueDate, invoice.status, money(invoice.total), money(invoice.paid), money(invoice.balance)]),
    theme: "striped",
    headStyles: { fillColor: [26, 53, 88], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5 },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });
  y = (doc as JsPdfDocument & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > 255) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.text("Facturación por cliente", 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [["Cliente", "Facturas", "Facturado", "Pagado", "Saldo"]],
    body: data.clients.map((client) => [client.client, String(client.invoices), money(client.billed), money(client.paid), money(client.balance)]),
    theme: "grid",
    headStyles: { fillColor: [26, 53, 88], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });
  doc.save(`reporte-${data.from}-${data.to}.pdf`);
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ");
}
import type JsPdfDocument from "jspdf";
