import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Shield,
  Tags,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadCount } from "@/hooks/use-notifications";
import { navForRole, canAccessPath } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  inbox: Inbox,
  "file-text": FileText,
  "plus-circle": PlusCircle,
  "user-check": UserCheck,
  bell: Bell,
  user: User,
  users: Users,
  building: Building2,
  tags: Tags,
  settings: Settings,
  "bar-chart": BarChart3,
  shield: Shield,
};

export function AppShell() {
  const { loading, session, profile, role, org, signOut, profileError, refresh } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    // Genera avisos de vencimiento (próximas a vencer / vencidas) una vez por carga de sesión.
    if (profile?.is_active) void supabase.rpc("refresh_due_alerts");
  }, [profile?.id, profile?.is_active]);
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-56" />
      </div>
    );
  }
  if (profileError && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">No se pudo cargar su cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Hubo un problema de conexión al obtener sus datos. Revise su conexión e inténtelo
            nuevamente.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => refresh()}>Reintentar</Button>
            <Button
              variant="outline"
              onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile || !profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Cuenta no disponible</h1>
          <p className="text-sm text-muted-foreground">
            Su cuenta está desactivada o no tiene un perfil asociado. Contacte al administrador.
          </p>
          <Button onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const items = navForRole(role);
  const render = (group: "principal" | "admin") =>
    items
      .filter((i) => i.group === group)
      .map((i) => {
        const Icon = ICONS[i.icon] ?? FileText;
        const active =
          path === i.to ||
          (i.to !== "/solicitudes" &&
            i.to !== "/solicitudes/nueva" &&
            path.startsWith(i.to + "/")) ||
          (i.to === "/solicitudes" &&
            path.startsWith("/solicitudes/") &&
            path !== "/solicitudes/nueva" &&
            role !== "empleado");
        return (
          <Link
            key={i.to}
            to={i.to as "/dashboard"}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{i.label}</span>
            {i.to === "/notificaciones" && unread > 0 && (
              <span className="rounded-full bg-sidebar-primary px-2 text-xs font-semibold text-sidebar-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      });

  const adminItems = items.some((i) => i.group === "admin");

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 text-base font-semibold text-sidebar-accent-foreground">
        <ClipboardList className="size-6 text-sidebar-primary" />
        <span className="truncate">{org?.name ?? "Solicitudes"}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {render("principal")}
        {adminItems && (
          <>
            <p className="px-3 pt-5 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Administración
            </p>
            {render("admin")}
          </>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
          {profile.full_name}
        </p>
        <p className="mb-3 text-xs text-sidebar-foreground/70">{ROLE_LABEL[role]}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="mr-2 size-4" /> Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <span className="font-semibold">{org?.name ?? "Solicitudes"}</span>
          <Link to="/notificaciones" className="relative p-2" aria-label="Notificaciones">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-0 top-0 size-2 rounded-full bg-destructive" />
            )}
          </Link>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          {canAccessPath(role, path) ? (
            <Outlet />
          ) : (
            <EmptyState
              title="Acceso restringido"
              description="No tiene permisos para ver esta sección."
              action={
                <Button asChild>
                  <Link to="/dashboard">Volver al dashboard</Link>
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
