import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "responsable", "empleado"]);

type Ctx = { supabase: any; userId: string };

async function requireAdmin(ctx: Ctx) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Solo un administrador puede gestionar usuarios");
  const { data: me } = await ctx.supabase
    .from("profiles")
    .select("organization_id, is_active")
    .eq("id", ctx.userId)
    .single();
  if (!me?.is_active) throw new Error("Cuenta inactiva");
  return me.organization_id as string;
}

async function audit(admin: any, org: string, actor: string, action: string, entityId: string, details: object) {
  await admin.from("audit_logs").insert({
    organization_id: org,
    actor_id: actor,
    action,
    entity: "usuario",
    entity_id: entityId,
    details,
  });
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        full_name: z.string().trim().min(2).max(120),
        role: roleEnum,
        department_id: z.string().uuid().nullable(),
        position: z.string().trim().max(120).nullable(),
        phone: z.string().trim().max(40).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      // app_metadata solo puede escribirse desde el servidor: es la fuente confiable de la organización.
      app_metadata: { organization_id: org },
      user_metadata: {
        full_name: data.full_name,
        department_id: data.department_id ?? "",
        position: data.position ?? "",
      },
    });
    if (error || !created.user) {
      const msg = error?.message ?? "";
      if (/already|registered|exists/i.test(msg)) throw new Error("Ya existe un usuario con ese correo");
      if (/weak|pwned|password/i.test(msg)) throw new Error("La contraseña es demasiado débil o conocida");
      console.error("[createUser]", msg);
      throw new Error("No se pudo crear el usuario. Inténtelo nuevamente");
    }
    const id = created.user.id;
    // Asignar el rol: primero el nuevo y luego se eliminan los demás, para no dejar nunca al usuario sin rol.
    const rollback = async () => {
      await supabaseAdmin.auth.admin.deleteUser(id);
    };
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) {
      console.error("[createUser:role]", roleErr.message);
      await rollback();
      throw new Error("No se pudo asignar el rol al usuario. Inténtelo nuevamente");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id).neq("role", data.role);
    const { error: profErr } = await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", id);
    if (profErr) console.error("[createUser:profile]", profErr.message);
    await audit(supabaseAdmin, org, context.userId, "creacion", id, {
      email: data.email,
      rol: data.role,
    });
    return { id };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().trim().min(2).max(120),
        role: roleEnum,
        department_id: z.string().uuid().nullable(),
        position: z.string().trim().max(120).nullable(),
        phone: z.string().trim().max(40).nullable(),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireAdmin(context as Ctx);
    if (data.id === context.userId && (!data.is_active || data.role !== "admin")) {
      throw new Error("No puede desactivarse ni quitarse el rol de administrador a sí mismo");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", data.id)
      .single();
    if (!target || target.organization_id !== org) throw new Error("Usuario no encontrado");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        department_id: data.department_id,
        position: data.position,
        phone: data.phone,
        is_active: data.is_active,
      })
      .eq("id", data.id);
    if (error) {
      console.error("[updateUser]", error.message);
      throw new Error("No se pudo actualizar el usuario. Inténtelo nuevamente");
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) {
      console.error("[updateUser:role]", roleErr.message);
      throw new Error("No se pudo actualizar el rol del usuario");
    }
    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id).neq("role", data.role);
    if (delErr) throw new Error(/administrador/i.test(delErr.message) ? delErr.message : "No se pudo actualizar el rol del usuario");
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.is_active ? "none" : "876000h",
    });
    await audit(supabaseAdmin, org, context.userId, "edicion", data.id, {
      rol: data.role,
      activo: data.is_active,
    });
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", data.id)
      .single();
    if (!target || target.organization_id !== org) throw new Error("Usuario no encontrado");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) {
      if (/weak|pwned/i.test(error.message)) throw new Error("La contraseña es demasiado débil o conocida");
      console.error("[setUserPassword]", error.message);
      throw new Error("No se pudo cambiar la contraseña. Inténtelo nuevamente");
    }
    await audit(supabaseAdmin, org, context.userId, "cambio_contrasena", data.id, {});
    return { ok: true };
  });
