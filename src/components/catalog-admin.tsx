import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/domain";
import { EmptyState, PageHeader, TableSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type Base = { id: string; name: string; description: string | null; is_active: boolean };

export function CatalogAdmin<T extends Base>({
  title,
  description,
  newLabel,
  items,
  loading,
  error,
  onRetry,
  columns,
  renderForm,
  empty,
  save,
  toggle,
  invalidate,
}: {
  title: string;
  description: string;
  newLabel: string;
  items: T[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  columns: { header: string; cell: (row: T) => ReactNode }[];
  renderForm: (state: Record<string, string>, set: (k: string, v: string) => void) => ReactNode;
  empty: Record<string, string>;
  save: (state: Record<string, string>, id?: string) => Promise<void>;
  toggle: (row: T) => Promise<void>;
  invalidate: string[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ id?: string; values: Record<string, string> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const saveM = useMutation({
    mutationFn: async () => {
      if (form) await save(form.values, form.id);
    },
    onSuccess: () => {
      toast.success("Guardado correctamente");
      setForm(null);
      setErr(null);
      done();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggleM = useMutation({
    mutationFn: toggle,
    onSuccess: () => {
      toast.success("Estado actualizado");
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            onClick={() => {
              setErr(null);
              setForm({ values: { ...empty } });
            }}
          >
            <Plus className="mr-2 size-4" />
            {newLabel}
          </Button>
        }
      />
      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !items?.length ? (
        <EmptyState title="Sin registros" description="Cree el primero con el botón superior." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Nombre</th>
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
                <th>Activo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{row.name}</p>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    )}
                  </td>
                  {columns.map((c) => (
                    <td key={c.header}>{c.cell(row)}</td>
                  ))}
                  <td>
                    <Switch
                      checked={row.is_active}
                      disabled={toggleM.isPending}
                      onCheckedChange={() => toggleM.mutate(row)}
                      aria-label={`Activar o desactivar ${row.name}`}
                    />
                  </td>
                  <td className="pr-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${row.name}`}
                      onClick={() => {
                        setErr(null);
                        setForm({
                          id: row.id,
                          values: {
                            name: row.name,
                            description: row.description ?? "",
                            ...Object.fromEntries(
                              Object.keys(empty)
                                .filter((k) => !["name", "description"].includes(k))
                                .map((k) => [
                                  k,
                                  String((row as unknown as Record<string, unknown>)[k] ?? ""),
                                ]),
                            ),
                          },
                        });
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && !saveM.isPending && setForm(null)}>
        <DialogContent>
          {form && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                saveM.mutate();
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar" : newLabel}</DialogTitle>
              </DialogHeader>
              {err && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {err}
                </p>
              )}
              {renderForm(form.values, (k, v) =>
                setForm({ ...form, values: { ...form.values, [k]: v } }),
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(null)}
                  disabled={saveM.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveM.isPending}>
                  {saveM.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
