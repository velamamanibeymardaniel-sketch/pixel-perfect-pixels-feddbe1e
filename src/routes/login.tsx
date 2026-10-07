import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { loginSchema, translateAuthError } from "@/lib/auth-schemas";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "recover">("login");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      setFormError(translateAuthError(error.message));
      return;
    }
    try {
      await supabase.rpc("log_event", { _action: "login" });
    } catch {
      /* el registro de acceso no debe bloquear el ingreso */
    }
    setBusy(false);
    navigate({ to: "/dashboard", replace: true });
  }

  async function onRecover(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setFormError("No se pudo enviar el correo de recuperación. Intente más tarde");
      return;
    }
    toast.success("Si el correo está registrado, recibirá un enlace para restablecer su contraseña");
    setMode("login");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-brand hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <ClipboardList className="size-7" /> Gestión de Solicitudes
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">Cada solicitud, con seguimiento hasta su cierre.</h1>
          <p className="text-primary-foreground/80">
            Registre, asigne y resuelva solicitudes internas con trazabilidad, plazos y notificaciones.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Plataforma institucional de gestión interna</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 font-semibold text-primary lg:hidden">
              <ClipboardList className="size-6" /> Gestión de Solicitudes
            </div>
            <h2 className="text-2xl font-semibold">{mode === "login" ? "Iniciar sesión" : "Recuperar contraseña"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Ingrese con su cuenta institucional."
                : "Le enviaremos un enlace para crear una nueva contraseña."}
            </p>
          </div>
          <form onSubmit={mode === "login" ? onLogin : onRecover} className="space-y-4" noValidate>
            {formError && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            {mode === "login" && (
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} aria-invalid={!!errors.password} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "login" ? (busy ? "Ingresando…" : "Iniciar sesión") : busy ? "Enviando…" : "Enviar enlace"}
            </Button>
          </form>
          <button
            type="button"
            className="w-full text-center text-sm text-primary hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "recover" : "login");
              setFormError(null);
              setErrors({});
            }}
          >
            {mode === "login" ? "¿Olvidó su contraseña?" : "Volver a iniciar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
