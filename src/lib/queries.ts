import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Department, Profile, RequestRow, RequestType, RequestStatus, RequestPriority } from "@/lib/domain";

export type RequestListItem = RequestRow & {
  department: { name: string } | null;
  type: { name: string } | null;
  requester: { full_name: string } | null;
  assignee: { full_name: string } | null;
};

export const REQUEST_SELECT =
  "*, department:departments(name), type:request_types(name), requester:profiles!requests_requester_id_fkey(full_name), assignee:profiles!requests_assignee_id_fkey(full_name)";

export function useDepartments(onlyActive = false) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["departments", onlyActive],
    enabled: !!userId,
    queryFn: async (): Promise<Department[]> => {
      let q = supabase.from("departments").select("*").order("name");
      if (onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRequestTypes(onlyActive = false) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["request-types", onlyActive],
    enabled: !!userId,
    queryFn: async (): Promise<RequestType[]> => {
      let q = supabase.from("request_types").select("*").order("name");
      if (onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Usuarios con rol responsable o administrador (candidatos a asignación). */
export function useAssignees() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["assignees"],
    enabled: !!userId,
    queryFn: async (): Promise<Pick<Profile, "id" | "full_name">[]> => {
      const { data: roles, error: e1 } = await supabase.from("user_roles").select("user_id").in("role", ["responsable", "admin"]);
      if (e1) throw e1;
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids).eq("is_active", true).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type DashboardStats = {
  scope: "admin" | "responsable" | "empleado";
  total: number;
  by_status: Partial<Record<RequestStatus, number>>;
  open: number;
  overdue: number;
  due_soon: number;
  avg_attention_hours: number | null;
  avg_response_hours: number | null;
  avg_resolution_hours: number | null;
  by_department: { name: string; value: number }[];
  by_type: { name: string; value: number }[];
  by_priority: Partial<Record<RequestPriority, number>>;
  by_assignee: { name: string; value: number; open: number; resolved: number }[];
  timeline: { date: string; created: number; resolved: number }[];
};

export function useDashboardStats(from?: string | null, to?: string | null) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["dashboard-stats", userId, from ?? null, to ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardStats> => {
      const args: { _from?: string; _to?: string } = {};
      if (from) args._from = from;
      if (to) args._to = to;
      const { data, error } = await supabase.rpc("dashboard_stats", args);
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
  });
}

export function useRequestList(opts: { key: string; assigneeId?: string; requesterId?: string; limit?: number; openOnly?: boolean; dueBefore?: string; dueAfter?: string; order?: { column: string; ascending: boolean } }) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["requests-mini", opts, userId],
    enabled: !!userId,
    queryFn: async (): Promise<RequestListItem[]> => {
      let q = supabase.from("requests").select(REQUEST_SELECT);
      if (opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
      if (opts.requesterId) q = q.eq("requester_id", opts.requesterId);
      if (opts.openOnly) q = q.in("status", ["pendiente", "asignada", "en_proceso"]);
      if (opts.dueBefore) q = q.lt("due_at", opts.dueBefore);
      if (opts.dueAfter) q = q.gte("due_at", opts.dueAfter);
      const o = opts.order ?? { column: "created_at", ascending: false };
      q = q.order(o.column, { ascending: o.ascending }).limit(opts.limit ?? 8);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RequestListItem[];
    },
  });
}
