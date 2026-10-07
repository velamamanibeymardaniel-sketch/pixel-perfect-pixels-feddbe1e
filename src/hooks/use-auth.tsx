import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { primaryRole, type AppRole, type Organization, type Profile } from "@/lib/domain";

type AuthState = {
  session: Session | null;
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  roles: AppRole[];
  role: AppRole;
  org: Organization | null;
  isAdmin: boolean;
  isResponsable: boolean;
  /** true si falló la carga del perfil (por ejemplo, sin conexión); no implica cuenta desactivada. */
  profileError: boolean;
  signOut: () => Promise<void>;
  refresh: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const me = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: profile, error: pErr }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (pErr) throw pErr;
      let org: Organization | null = null;
      if (profile) {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .maybeSingle();
        org = data;
      }
      return { profile, roles: (roles ?? []).map((r) => r.role), org };
    },
  });

  const roles = me.data?.roles ?? [];
  const role = primaryRole(roles);
  const value: AuthState = {
    session,
    loading: !ready || (!!userId && me.isLoading),
    userId,
    profile: me.data?.profile ?? null,
    roles,
    role,
    org: me.data?.org ?? null,
    isAdmin: role === "admin",
    isResponsable: role === "responsable",
    profileError: me.isError,
    signOut: async () => {
      try {
        await supabase.rpc("log_event", { _action: "logout" });
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut();
      qc.clear();
    },
    refresh: () => qc.invalidateQueries({ queryKey: ["me"] }),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
