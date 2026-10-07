# Gestión de Solicitudes

Plataforma web para gestionar **solicitudes internas** de una organización: registro, asignación, seguimiento, resolución y cierre, con roles, notificaciones, historial, estadísticas, reportes y auditoría. Proyecto académico.

## Objetivo

Centralizar las solicitudes internas (soporte técnico, accesos, permisos, reembolsos, compras, mantenimiento…) para que cada una tenga un responsable, un plazo y un historial completo, y para que la organización pueda medir tiempos de atención y cumplimiento.

## Funcionalidades

- **Autenticación**: inicio y cierre de sesión, recuperación de contraseña por correo, rutas privadas protegidas, cuentas activables/desactivables.
- **Roles**: Empleado, Responsable y Administrador, con permisos aplicados en la base de datos (RLS y funciones SQL), no solo en la interfaz.
- **Solicitudes**: creación con título, descripción, tipo, departamento, prioridad y adjuntos; código automático (`SOL-00001`); plazo calculado según tipo/prioridad.
- **Ciclo de vida**: `Pendiente → Asignada → En proceso → Resuelta → Cerrada`, además de `Cancelada` y `Reabrir` (Resuelta → En proceso). Las transiciones inválidas se rechazan en la base de datos.
- **Detalle**: datos completos, comentarios, registro de acciones, archivos (subir/descargar con enlace temporal), historial cronológico, cambio de prioridad y reasignación.
- **Dashboard**: indicadores reales (total, por estado, vencidas, próximas a vencer), gráficos por estado/prioridad/departamento/tipo y evolución temporal, y tiempos medios.
- **Notificaciones**: creación, asignación, reasignación, comentarios, cambios de estado, resolución, cierre, archivos adjuntos, vencimiento y proximidad de vencimiento; contador de no leídas, marcar una/todas como leídas y actualización en tiempo real (Supabase Realtime). Los avisos de vencimiento se generan al abrir la aplicación (`refresh_due_alerts`); para generarlos sin que nadie inicie sesión, programe esa función con `pg_cron`.
- **Administración**: usuarios (crear, editar, buscar, rol, departamento, activar/desactivar, restablecer contraseña), departamentos, tipos de solicitud y configuración (organización, aviso de vencimiento, plazos por prioridad, cierre por el solicitante).
- **Reportes**: por estado, prioridad, departamento, tipo, responsable, vencidas y tiempos, con filtro por fechas y exportación a **PDF, Excel y CSV**.
- **Auditoría**: registro de sesiones, solicitudes, usuarios y configuración, con filtros; visible solo para administradores.
- **Interfaz** en español y adaptable a escritorio, tablet y móvil.

## Tecnologías

React 19 · TypeScript · TanStack Start / Router / Query · Supabase (PostgreSQL, Auth, Storage, Realtime) · Tailwind CSS 4 · Radix UI (shadcn/ui) · Zod · Recharts · jsPDF + SheetJS · Vitest + Testing Library · ESLint + Prettier.

## Arquitectura

```
Navegador (React) ──RLS──▶ Supabase (PostgreSQL + Auth + Storage)
        │                         ▲
        └── server functions ─────┘  (solo operaciones con service role: gestión de usuarios)
```

- **Base de datos**: esquema en `drizzle/migrations/`. Las reglas de negocio viven en funciones SQL (`create_request`, `assign_request`, `change_request_status`, `change_request_priority`, `update_request_due`, `add_request_comment`, `dashboard_stats`, `refresh_due_alerts`) que validan permisos y transiciones y registran historial, notificaciones y auditoría en la misma transacción. Todas las tablas tienen **Row Level Security**.
- **Frontend**: rutas por archivos en `src/routes/`. Las páginas privadas cuelgan del layout `_app.tsx` (sesión, menú por rol y control de acceso por ruta).
- **Servidor**: `src/lib/users.functions.ts` expone funciones de servidor que exigen un token válido, comprueban que quien llama es administrador y solo entonces usan la *service role key* (`src/integrations/supabase/client.server.ts`, que nunca se importa desde el cliente).

## Roles y permisos

| Acción | Empleado | Responsable | Administrador |
| --- | :-: | :-: | :-: |
| Crear solicitudes, comentar y adjuntar en las propias | ✔ | ✔ | ✔ |
| Ver solicitudes | Las propias | Las asignadas (y las propias) | Todas |
| Cancelar (pendiente/asignada) | Las propias | — | ✔ |
| Iniciar atención, resolver, registrar acciones | — | Las asignadas | ✔ |
| Cerrar una solicitud resuelta | Las propias (si la configuración lo permite) | — | ✔ |
| Reabrir una solicitud resuelta | Las propias | Las asignadas | ✔ |
| Asignar / reasignar / cambiar prioridad y fecha límite | — | — | ✔ |
| Panel del responsable y reportes | — | Su ámbito | Global |
| Usuarios, departamentos, tipos, configuración, auditoría | — | — | ✔ |

Los permisos se aplican en tres capas: menú y rutas (usabilidad), políticas RLS y funciones SQL (seguridad real) y funciones de servidor (operaciones con privilegios).

## Instalación

Requisitos: Node.js 20+ y un proyecto de [Supabase](https://supabase.com).

```sh
npm install
cp .env.example .env     # complete con los datos de su proyecto Supabase
```

### Configuración de Supabase

1. Cree un proyecto en Supabase.
2. En el **SQL Editor**, ejecute en orden:
   1. `drizzle/migrations/0000_base_schema.sql` (tablas, RLS, funciones y datos de ejemplo)
   2. `drizzle/migrations/0001_request_scoping_and_attachment_events.sql` (alcance del responsable y eventos de adjuntos)
   3. `drizzle/migrations/0002_attachments_bucket.sql` (bucket privado `attachments`)
   4. `drizzle/migrations/0003_security_hardening.sql` (endurecimiento: alta de usuarios, adjuntos, tipos MIME, fecha límite y protección del último administrador)
3. Cree el primer administrador en *Authentication → Users* y asígnele el rol:
   ```sql
   update public.user_roles set role = 'admin' where user_id = '<uuid-del-usuario>';
   ```
   Desde ahí, el administrador crea y gestiona al resto de usuarios en la plataforma.
4. En *Authentication → Providers → Email* **desactive el registro público** («Allow new users to sign up»): las cuentas las crea el administrador.
5. En *Authentication → URL Configuration* añada `http://localhost:3000/reset-password` (y su dominio de producción) a las URLs de redirección.
6. Copie URL, clave pública (publishable/anon) y service role key a `.env`.

### Variables de entorno

| Variable | Dónde | Descripción |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Navegador | Datos públicos del proyecto |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Servidor | Igual que las anteriores, para SSR y server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** | Gestión de usuarios. Nunca con prefijo `VITE_`, nunca en el repositorio (`.env` está en `.gitignore`) |
| `DATABASE_URL` | Local (opcional) | Solo para `drizzle-kit` |

## Ejecución

```sh
npm run dev        # desarrollo (http://localhost:3000)
npm run build      # compilación de producción
npm run preview    # servir la compilación
npm run test       # pruebas (Vitest)
npm run lint       # ESLint
```

> Al ejecutar `dev` o `build` el plugin de TanStack Router regenera `src/routeTree.gen.ts`. `@lovable.dev/vite-tanstack-config` es solo un paquete de configuración de Vite (TanStack Start, React, Tailwind, Nitro); no añade funcionalidad a la aplicación.

## Pruebas

`npm run test` ejecuta:

- **Dominio y permisos**: roles, navegación por rol, bloqueo de rutas, matriz de transiciones de estado por actor.
- **Validaciones**: login, nueva solicitud, adjuntos (tamaño, cantidad, tipo, vacíos), exportación CSV segura.
- **Contrato con el SQL**: las transiciones de la interfaz coinciden con `change_request_status`; cada acción registra historial, notificación y auditoría; todas las tablas tienen RLS; los roles y la auditoría no son escribibles desde el cliente; la *service role key* no aparece fuera de `client.server.ts`.
- **Rutas**: todas las pantallas resuelven y las privadas cuelgan de `/_app`.
- **Mensajes de error**: nunca se muestran errores técnicos al usuario.

## Estructura

```
src/
  routes/            # login, reset-password y _app/* (páginas privadas)
  components/        # app-shell, badges, estados, tablas, catálogos, ui/ (shadcn)
  hooks/             # use-auth, use-notifications
  lib/               # dominio, permisos, esquemas Zod, consultas, exportación, funciones de servidor, pruebas
  integrations/supabase/  # clientes y tipos
drizzle/migrations/  # esquema SQL, RLS, funciones y endurecimiento
```
