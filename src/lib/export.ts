import * as XLSX from "xlsx";

export type ReportSection = { title: string; head: string[]; rows: (string | number)[][] };

export function exportExcel(sections: ReportSection[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sections) {
    const ws = XLSX.utils.aoa_to_sheet([s.head, ...s.rows]);
    XLSX.utils.book_append_sheet(wb, ws, s.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Evita la inyección de fórmulas al abrir el CSV en Excel/Calc (valores que empiezan con = + - @). */
export function csvSafe(v: string | number): string {
  const str = String(v);
  return typeof v === "string" && /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

export function toCsv(section: ReportSection): string {
  const esc = (v: string | number) => `"${csvSafe(v).replace(/"/g, '""')}"`;
  return [section.head, ...section.rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function exportCsv(section: ReportSection, filename: string) {
  const blob = new Blob(["\uFEFF" + toCsv(section)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPdf(sections: ReportSection[], title: string, filename: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  let y = 24;
  for (const s of sections) {
    autoTable(doc, {
      startY: y,
      head: [[{ content: s.title, colSpan: s.head.length }], s.head],
      body: s.rows.map((r) => r.map(String)),
      theme: "striped",
      styles: { fontSize: 9 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  doc.save(`${filename}.pdf`);
}
