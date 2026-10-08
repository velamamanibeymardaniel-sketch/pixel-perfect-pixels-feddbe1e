import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/domain";
import { ago } from "@/lib/time";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notificaciones")({ component: NotificationsPage });

function NotificationsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };
  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId!)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Todas marcadas como leídas");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unread = list.data?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificaciones"
        description={unread ? `${unread} sin leer` : "Está al día."}
        actions={
          <Button
            variant="outline"
            disabled={!unread || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="mr-2 size-4" />
            Marcar todas como leídas
          </Button>
        }
      />
      {list.isLoading ? (
        <TableSkeleton rows={5} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState
          title="Sin notificaciones"
          description="Aquí verá los avisos sobre sus solicitudes."
        />
      ) : (
        <ul className="space-y-2">
          {list.data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40",
                  !n.is_read && "border-primary/40 bg-accent/40",
                )}
                onClick={() => {
                  if (!n.is_read) markOne.mutate(n.id);
                  if (n.request_id)
                    navigate({ to: "/solicitudes/$id", params: { id: n.request_id } });
                }}
              >
                <Bell
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    n.is_read ? "text-muted-foreground" : "text-primary",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{n.message}</span>
                  <span className="block text-xs text-muted-foreground">{ago(n.created_at)}</span>
                </span>
                {!n.is_read && (
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    aria-label="No leída"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
