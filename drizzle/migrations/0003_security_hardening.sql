-- 0003 · Endurecimiento de seguridad. No modifica tablas ni funciones de negocio existentes
-- salvo las indicadas; es idempotente y puede ejecutarse sobre una base ya migrada (0000-0002).

-- 1) Alta de usuarios: la organización se toma de app_metadata (solo escribible desde el servidor
--    con la service role key). Antes se leía de user_metadata, que cualquier persona puede definir
--    en un registro público y habría permitido unirse a otra organización.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _role public.app_role; _dep uuid;
BEGIN
  _org := COALESCE(
    NULLIF(NEW.raw_app_meta_data->>'organization_id','')::uuid,
    (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1));
  IF _org IS NULL THEN RETURN NEW; END IF;
  _role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'app_role','')::public.app_role, 'empleado');
  -- El departamento solo se acepta si pertenece a la organización.
  SELECT d.id INTO _dep FROM public.departments d
   WHERE d.id = NULLIF(NEW.raw_user_meta_data->>'department_id','')::uuid AND d.organization_id = _org;
  INSERT INTO public.profiles(id, organization_id, full_name, email, department_id, position)
  VALUES (NEW.id, _org, COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1)), NEW.email,
          _dep, NULLIF(NEW.raw_user_meta_data->>'position',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- 2) Adjuntos: la ruta debe empezar por el id de la solicitud y solo se permite adjuntar
--    mientras la solicitud no esté finalizada (los administradores pueden siempre).
DROP POLICY IF EXISTS "insert attachments on accessible" ON public.attachments;
CREATE POLICY "insert attachments on accessible" ON public.attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.can_access_request(request_id)
  AND split_part(storage_path, '/', 1) = request_id::text
  AND (
    public.is_org_admin()
    OR EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.status NOT IN ('cerrada','cancelada'))
  )
);

-- 3) Bucket de adjuntos: límite de 20 MB y lista blanca de tipos MIME.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain','text/csv','image/png','image/jpeg','image/gif','image/webp',
      'application/zip','application/x-zip-compressed']
WHERE id = 'attachments';

-- 4) Fecha límite: solo sobre solicitudes abiertas y siempre en el futuro.
CREATE OR REPLACE FUNCTION public.update_request_due(_request_id uuid, _due_at timestamptz)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'Solo un administrador puede cambiar la fecha límite'; END IF;
  IF _due_at IS NULL OR _due_at <= now() THEN RAISE EXCEPTION 'La fecha límite debe ser futura'; END IF;
  SELECT * INTO _req FROM public.requests WHERE id=_request_id AND organization_id=_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _req.status IN ('cerrada','cancelada') THEN RAISE EXCEPTION 'No se puede modificar una solicitud finalizada'; END IF;
  UPDATE public.requests SET due_at=_due_at WHERE id=_request_id RETURNING * INTO _req;
  DELETE FROM public.notifications WHERE request_id=_request_id AND type IN ('proxima_vencer','vencida');
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, auth.uid(), 'Fecha límite actualizada', _req.status, _req.status, to_char(_due_at AT TIME ZONE 'America/La_Paz', 'DD/MM/YYYY HH24:MI'));
  PERFORM public._audit(_org, 'edicion', 'solicitud', _request_id, jsonb_build_object('codigo', _req.code, 'fecha_limite', _due_at));
  RETURN _req;
END $$;

-- 5) Un administrador no puede quedarse sin ningún administrador activo en la organización
--    (defensa adicional a la validación del servidor).
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _remaining int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'admin' THEN RETURN OLD; END IF;
    SELECT organization_id INTO _org FROM public.profiles WHERE id = OLD.user_id;
    IF _org IS NULL THEN RETURN OLD; END IF; -- el perfil ya se eliminó en cascada
    SELECT count(*) INTO _remaining FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'admin' AND p.organization_id = _org AND p.is_active AND ur.id <> OLD.id;
    IF _remaining = 0 THEN RAISE EXCEPTION 'Debe existir al menos un administrador activo'; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_last_admin ON public.user_roles;
CREATE TRIGGER trg_guard_last_admin BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();
