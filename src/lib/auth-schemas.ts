import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingrese su correo electrónico").email("Correo electrónico inválido"),
  password: z.string().min(1, "Ingrese su contraseña"),
});

export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Correo o contraseña incorrectos";
  if (/email not confirmed/i.test(message)) return "Debe confirmar su correo antes de ingresar";
  if (/banned|disabled/i.test(message)) return "Su cuenta está desactivada. Contacte al administrador";
  if (/rate limit|too many/i.test(message)) return "Demasiados intentos. Espere unos minutos";
  if (/network|fetch/i.test(message)) return "No hay conexión con el servidor";
  return "No se pudo iniciar sesión. Intente nuevamente";
}
