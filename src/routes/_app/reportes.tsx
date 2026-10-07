import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { useDashboardStats } from "@/lib/queries";
import { buildSections } from "@/lib/report-sections";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";
import { ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/reportes")({ component: ReportsPage });

function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const fromIso = from ? new Date(from + "T00:00:00").toISOString() : null;
  const toIso = to ? new Date(new Date(to + "T00:00:00").getTime() + 864e5).toISOString() : null;
  const stats = useDashboardStats(fromIso, toIso);
  const s = stats.data;
  const sections = s ? buildSections(s) : [];
  const name = `reporte-solicitudes-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Indicadores calculados con los datos reales del sistema."
        actions={<>
          <Button variant="outline" disabled={!s} onClick={() => exportPdf(sections, "Reporte de solicitudes", name).catch(() => toast.error("No se pudo generar el PDF"))}><FileText className="mr-2 size-4" />PDF</Button>
          <Button variant="outline" disabled={!s} onClick={() => exportExcel(sections, name)}><FileSpreadsheet className="mr-2 size-4" />Excel</Button>
          <Button variant="outline" disabled={!s} onClick={() => exportCsv({ title: "Resumen", head: ["Sección", "Concepto", "Valor"], rows: sections.flatMap((x) => x.rows.map((r) => [x.title, String(r[0]), r.slice(1).join(" / ")])) }, name)}><FileDown className="mr-2 size-4" />CSV</Button>
        </>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Periodo de creación:</span>
        <Input type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <Input type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
        {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpiar</Button>}
      </div>
      {stats.isLoading ? <TableSkeleton /> : stats.isError ? <ErrorState error={stats.error} onRetry={() => stats.refetch()} /> : s && (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((sec) => (
            <Card key={sec.title}>
              <CardHeader><CardTitle className="text-base">{sec.title}</CardTitle></CardHeader>
              <CardContent>
                {sec.rows.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p> : (
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr>{sec.head.map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr></thead>
                    <tbody>{sec.rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}</tr>)}</tbody></table></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
