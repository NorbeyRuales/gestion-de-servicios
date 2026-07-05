import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../lib/supabase";

export interface WorkReportRow {
  code: string;
  client: string;
  branch: string;
  area: string;
  asset: string;
  serviceType: string;
  technician: string;
  startDate: string | null;
  completionDate: string | null;
  reportedProblem: string;
  workPerformed: string;
  observations: string;
  pendingItems: string;
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "Sin registrar";
}

function duration(start: string | null, end: string | null) {
  if (!start || !end) return "Sin registrar";
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours} h ` : ""}${remainder} min`;
}

function addHeader(doc: jsPDF, companyName: string, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 53, 88);
  doc.rect(0, 0, width, 32, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), 14, 12);
  doc.setFontSize(11);
  doc.text(title, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(subtitle, width - 14, 12, { align: "right" });
  doc.setTextColor(31, 41, 55);
}

export function exportWorkReportPdf(companyName: string, rows: WorkReportRow[], from?: string, to?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const period = from && to ? `Período: ${from} a ${to}` : `Generado: ${new Date().toLocaleString("es-CO")}`;
  addHeader(doc, companyName, rows.length === 1 ? `REPORTE DE TRABAJO · ${rows[0].code}` : "REPORTE DE TRABAJOS REALIZADOS", period);

  rows.forEach((row, index) => {
    if (index > 0) doc.addPage();
    if (index > 0) addHeader(doc, companyName, `REPORTE DE TRABAJO · ${row.code}`, period);
    autoTable(doc, {
      startY: 39,
      body: [
        ["Orden", row.code, "Tipo de servicio", row.serviceType],
        ["Cliente", row.client, "Sede", row.branch],
        ["Área", row.area, "Equipo", row.asset],
        ["Técnico", row.technician, "Duración", duration(row.startDate, row.completionDate)],
        ["Inicio", dateTime(row.startDate), "Finalización", dateTime(row.completionDate)],
      ],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2.4 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [238, 243, 248] }, 2: { fontStyle: "bold", fillColor: [238, 243, 248] } },
    });
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    autoTable(doc, {
      startY: finalY,
      head: [["Detalle del servicio", "Información registrada"]],
      body: [
        ["Problema reportado", row.reportedProblem || "Sin registrar"],
        ["Trabajo realizado", row.workPerformed || "Sin registrar"],
        ["Observaciones", row.observations || "Sin observaciones"],
        ["Pendientes", row.pendingItems || "Sin pendientes"],
      ],
      theme: "grid",
      headStyles: { fillColor: [249, 115, 22], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 42, fontStyle: "bold" } },
    });
  });
  doc.save(rows.length === 1 ? `reporte-${rows[0].code}.pdf` : `reporte-trabajos-${from}-${to}.pdf`);
}

export async function exportSingleWorkOrderPdf(orderId: string) {
  const [orderResult, companyResult] = await Promise.all([
    supabase.from("work_orders").select("code,start_date,completion_date,reported_problem,work_performed,observations,pending_items,clients(name),branches(name),areas(name),assets(name),service_types(name),technicians(name)").eq("id", orderId).single(),
    supabase.from("company_settings").select("business_name").eq("id", 1).single(),
  ]);
  if (orderResult.error) throw orderResult.error;
  const order = orderResult.data as unknown as {
    code: string; start_date: string | null; completion_date: string | null; reported_problem: string | null; work_performed: string | null; observations: string | null; pending_items: string | null;
    clients: { name: string } | null; branches: { name: string } | null; areas: { name: string } | null; assets: { name: string } | null; service_types: { name: string } | null; technicians: { name: string } | null;
  };
  exportWorkReportPdf(companyResult.data?.business_name || "Gestor de Servicios", [{
    code: order.code, client: order.clients?.name || "Cliente", branch: order.branches?.name || "Sin sede", area: order.areas?.name || "Sin área", asset: order.assets?.name || "Sin equipo", serviceType: order.service_types?.name || "Servicio", technician: order.technicians?.name || "Sin técnico", startDate: order.start_date, completionDate: order.completion_date, reportedProblem: order.reported_problem || "", workPerformed: order.work_performed || "", observations: order.observations || "", pendingItems: order.pending_items || "",
  }]);
}
