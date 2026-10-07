CREATE TYPE public.app_role AS ENUM ('admin','responsable','empleado');
CREATE TYPE public.request_status AS ENUM ('pendiente','asignada','en_proceso','resuelta','cerrada','cancelada');
CREATE TYPE public.request_priority AS ENUM ('baja','media','alta','critica');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 150),
  legal_name text, tax_id text, email text, phone text, address text, website text,
  logo_url text CHECK (logo_url IS NULL OR char_length(logo_url) <= 400000),
  timezone text NOT NULL DEFAULT 'America/La_Paz',
  due_soon_hours integer NOT NULL DEFAULT 24 CHECK (due_soon_hours BETWEEN 1 AND 720),
  default_sla_hours integer NOT NULL DEFAULT 72 CHECK (default_sla_hours BETWEEN 1 AND 8760),
  allow_requester_close boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_departments_org ON public.departments(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position text, phone text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(lower(email));
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description text,
  default_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  sla_hours integer CHECK (sla_hours IS NULL OR sla_hours BETWEEN 1 AND 8760),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_request_types_org ON public.request_types(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_types TO authenticated;
GRANT ALL ON public.request_types TO service_role;
ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.priority_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  priority public.request_priority NOT NULL,
  label text NOT NULL,
  sla_hours integer NOT NULL CHECK (sla_hours BETWEEN 1 AND 8760),
  PRIMARY KEY (organization_id, priority)
);
GRANT SELECT, INSERT, UPDATE ON public.priority_settings TO authenticated;
GRANT ALL ON public.priority_settings TO service_role;
ALTER TABLE public.priority_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.request_counters (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.request_counters TO service_role;
ALTER TABLE public.request_counters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 5 AND 5000),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  request_type_id uuid NOT NULL REFERENCES public.request_types(id) ON DELETE RESTRICT,
  priority public.request_priority NOT NULL DEFAULT 'media',
  status public.request_status NOT NULL DEFAULT 'pendiente',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz, started_at timestamptz,
  due_at timestamptz NOT NULL,
  resolved_at timestamptz, closed_at timestamptz, cancelled_at timestamptz,
  resolution_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_requests_org_status ON public.requests(organization_id, status);
CREATE INDEX idx_requests_requester ON public.requests(requester_id);
CREATE INDEX idx_requests_assignee ON public.requests(assignee_id);
CREATE INDEX idx_requests_due ON public.requests(due_at);
CREATE INDEX idx_requests_created ON public.requests(organization_id, created_at DESC);
GRANT SELECT ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status public.request_status,
  to_status public.request_status,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_request ON public.request_status_history(request_id, created_at);
GRANT SELECT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  is_action boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_request ON public.request_comments(request_id, created_at);
GRANT SELECT ON public.request_comments TO authenticated;
GRANT ALL ON public.request_comments TO service_role;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 20971520),
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_request ON public.attachments(request_id);
GRANT SELECT, INSERT ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX uq_notifications_due ON public.notifications(user_id, request_id, type) WHERE type IN ('proxima_vencer','vencida');
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_logs(organization_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND is_active
$$;
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') AND public.current_org_id() IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable')
           OR r.requester_id = auth.uid() OR r.assignee_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_org_touch BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_dep_touch BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_prof_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_type_touch BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_req_touch BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public._audit(_org uuid, _action text, _entity text, _entity_id uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(organization_id, actor_id, action, entity, entity_id, details)
  VALUES (_org, auth.uid(), _action, _entity, _entity_id, COALESCE(_details,'{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public._audit(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._notify(_user uuid, _request uuid, _type text, _title text, _message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, request_id, type, title, message)
  VALUES (_user, _request, _type, _title, _message) ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public._notify(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_event(_action text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR _action NOT IN ('login','logout') THEN RAISE EXCEPTION 'Evento no permitido'; END IF;
  IF _action = 'login' THEN UPDATE public.profiles SET last_login_at = now() WHERE id = auth.uid(); END IF;
  PERFORM public._audit(public.current_org_id(), _action, 'sesion', auth.uid(), _details);
END $$;

CREATE POLICY "org members read org" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "admins update org" ON public.organizations FOR UPDATE TO authenticated USING (id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (id = public.current_org_id());

CREATE POLICY "org members read departments" ON public.departments FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "admins update departments" ON public.departments FOR UPDATE TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "admins delete departments" ON public.departments FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "org members read types" ON public.request_types FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins insert types" ON public.request_types FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "admins update types" ON public.request_types FOR UPDATE TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "admins delete types" ON public.request_types FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "org members read priorities" ON public.priority_settings FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins insert priorities" ON public.priority_settings FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE POLICY "admins update priorities" ON public.priority_settings FOR UPDATE TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "self or org read profiles" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "self or admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (organization_id = public.current_org_id() AND public.is_org_admin()))
  WITH CHECK (organization_id = public.current_org_id() OR id = auth.uid());

CREATE POLICY "org read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.organization_id = public.current_org_id()));

CREATE POLICY "role scoped read requests" ON public.requests FOR SELECT TO authenticated USING (
  organization_id = public.current_org_id() AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable')
    OR requester_id = auth.uid() OR assignee_id = auth.uid()));

CREATE POLICY "read history of accessible" ON public.request_status_history FOR SELECT TO authenticated USING (public.can_access_request(request_id));
CREATE POLICY "read comments of accessible" ON public.request_comments FOR SELECT TO authenticated USING (public.can_access_request(request_id));
CREATE POLICY "read attachments of accessible" ON public.attachments FOR SELECT TO authenticated USING (public.can_access_request(request_id));
CREATE POLICY "insert attachments on accessible" ON public.attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND public.can_access_request(request_id));

CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_org_admin() THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.email IS DISTINCT FROM OLD.email OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      RAISE EXCEPTION 'No tiene permisos para modificar estos campos';
    END IF;
  ELSE
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'No se puede cambiar la organización'; END IF;
    IF NEW.id = auth.uid() AND NEW.is_active = false THEN RAISE EXCEPTION 'No puede desactivar su propia cuenta'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE OR REPLACE FUNCTION public.audit_config_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _id uuid; _rec jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN _rec := to_jsonb(OLD); ELSE _rec := to_jsonb(NEW); END IF;
  _id := (_rec->>'id')::uuid;
  _org := COALESCE((_rec->>'organization_id')::uuid, CASE WHEN TG_TABLE_NAME='organizations' THEN _id END);
  IF TG_TABLE_NAME = 'organizations' THEN _rec := _rec - 'logo_url'; END IF;
  INSERT INTO public.audit_logs(organization_id, actor_id, action, entity, entity_id, details)
  VALUES (_org, auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'creacion' WHEN 'UPDATE' THEN 'edicion' ELSE 'eliminacion' END,
    TG_TABLE_NAME, _id,
    CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('antes', to_jsonb(OLD) - 'logo_url', 'despues', to_jsonb(NEW) - 'logo_url') ELSE _rec END);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_audit_org AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();
CREATE TRIGGER trg_audit_dep AFTER INSERT OR UPDATE OR DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();
CREATE TRIGGER trg_audit_type AFTER INSERT OR UPDATE OR DELETE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();
CREATE TRIGGER trg_audit_prio AFTER UPDATE ON public.priority_settings FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _role public.app_role;
BEGIN
  _org := COALESCE(NULLIF(NEW.raw_user_meta_data->>'organization_id','')::uuid, (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1));
  IF _org IS NULL THEN RETURN NEW; END IF;
  _role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'app_role','')::public.app_role, 'empleado');
  INSERT INTO public.profiles(id, organization_id, full_name, email, department_id, position)
  VALUES (NEW.id, _org, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email,
          NULLIF(NEW.raw_user_meta_data->>'department_id','')::uuid, NEW.raw_user_meta_data->>'position')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.status_label(_s public.request_status)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _s WHEN 'pendiente' THEN 'Pendiente' WHEN 'asignada' THEN 'Asignada' WHEN 'en_proceso' THEN 'En proceso'
    WHEN 'resuelta' THEN 'Resuelta' WHEN 'cerrada' THEN 'Cerrada' ELSE 'Cancelada' END
$$;

CREATE OR REPLACE FUNCTION public.create_request(
  _title text, _description text, _request_type_id uuid, _department_id uuid,
  _priority public.request_priority, _due_at timestamptz DEFAULT NULL)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _num int; _req public.requests; _sla int; _uid uuid := auth.uid(); _admin record;
BEGIN
  _org := public.current_org_id();
  IF _uid IS NULL OR _org IS NULL THEN RAISE EXCEPTION 'Usuario no autorizado'; END IF;
  _title := btrim(_title); _description := btrim(_description);
  IF char_length(_title) < 3 THEN RAISE EXCEPTION 'El título debe tener al menos 3 caracteres'; END IF;
  IF char_length(_description) < 5 THEN RAISE EXCEPTION 'La descripción es demasiado corta'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.request_types WHERE id=_request_type_id AND organization_id=_org AND is_active) THEN RAISE EXCEPTION 'Tipo de solicitud inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id=_department_id AND organization_id=_org AND is_active) THEN RAISE EXCEPTION 'Área inválida'; END IF;
  IF _due_at IS NOT NULL AND _due_at <= now() THEN RAISE EXCEPTION 'La fecha límite debe ser futura'; END IF;
  IF _due_at IS NULL THEN
    SELECT COALESCE(
      (SELECT sla_hours FROM public.request_types WHERE id=_request_type_id),
      (SELECT sla_hours FROM public.priority_settings WHERE organization_id=_org AND priority=_priority),
      (SELECT default_sla_hours FROM public.organizations WHERE id=_org)) INTO _sla;
    _due_at := now() + make_interval(hours => _sla);
  END IF;
  INSERT INTO public.request_counters(organization_id, last_number) VALUES (_org, 1)
  ON CONFLICT (organization_id) DO UPDATE SET last_number = request_counters.last_number + 1
  RETURNING last_number INTO _num;
  INSERT INTO public.requests(organization_id, code, title, description, requester_id, department_id, request_type_id, priority, status, due_at)
  VALUES (_org, 'SOL-' || lpad(_num::text, 5, '0'), _title, _description, _uid, _department_id, _request_type_id, _priority, 'pendiente', _due_at)
  RETURNING * INTO _req;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status)
  VALUES (_req.id, _uid, 'Solicitud creada', NULL, 'pendiente');
  FOR _admin IN SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id AND ur.role='admin'
                WHERE p.organization_id=_org AND p.is_active AND p.id <> _uid LOOP
    PERFORM public._notify(_admin.id, _req.id, 'nueva_solicitud', 'Nueva solicitud ' || _req.code, _req.title);
  END LOOP;
  PERFORM public._notify(_uid, _req.id, 'nueva_solicitud', 'Solicitud registrada ' || _req.code, 'Su solicitud fue registrada y está pendiente de asignación.');
  PERFORM public._audit(_org, 'creacion', 'solicitud', _req.id, jsonb_build_object('codigo', _req.code, 'titulo', _req.title));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.assign_request(_request_id uuid, _assignee_id uuid, _comment text DEFAULT NULL)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _old uuid; _uid uuid := auth.uid(); _org uuid := public.current_org_id();
  _old_status public.request_status; _new_status public.request_status; _is_re boolean; _name text;
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'Solo un administrador puede asignar solicitudes'; END IF;
  SELECT * INTO _req FROM public.requests WHERE id=_request_id AND organization_id=_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _req.status IN ('cerrada','cancelada') THEN RAISE EXCEPTION 'No se puede asignar una solicitud finalizada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=_assignee_id AND p.organization_id=_org AND p.is_active
                 AND (public.has_role(p.id,'responsable') OR public.has_role(p.id,'admin'))) THEN
    RAISE EXCEPTION 'El usuario seleccionado no puede ser responsable'; END IF;
  IF _req.assignee_id = _assignee_id THEN RAISE EXCEPTION 'La solicitud ya está asignada a ese responsable'; END IF;
  _old := _req.assignee_id; _is_re := _old IS NOT NULL; _old_status := _req.status;
  _new_status := CASE WHEN _req.status IN ('pendiente','resuelta') THEN 'asignada'::public.request_status ELSE _req.status END;
  SELECT full_name INTO _name FROM public.profiles WHERE id=_assignee_id;
  UPDATE public.requests SET assignee_id=_assignee_id, assigned_by=_uid, assigned_at=now(), status=_new_status,
    resolved_at = CASE WHEN _old_status='resuelta' THEN NULL ELSE resolved_at END
  WHERE id=_request_id RETURNING * INTO _req;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, _uid, CASE WHEN _is_re THEN 'Reasignada a ' ELSE 'Asignada a ' END || _name, _old_status, _new_status, NULLIF(btrim(_comment),''));
  PERFORM public._notify(_assignee_id, _request_id, CASE WHEN _is_re THEN 'reasignada' ELSE 'asignada' END, 'Solicitud ' || _req.code || ' asignada a usted', _req.title);
  IF _is_re THEN PERFORM public._notify(_old, _request_id, 'reasignada', 'Solicitud ' || _req.code || ' reasignada', 'La solicitud fue reasignada a ' || _name || '.'); END IF;
  PERFORM public._notify(_req.requester_id, _request_id, CASE WHEN _is_re THEN 'reasignada' ELSE 'asignada' END,
    'Su solicitud ' || _req.code || ' fue ' || CASE WHEN _is_re THEN 'reasignada' ELSE 'asignada' END, 'Responsable: ' || _name);
  PERFORM public._audit(_org, CASE WHEN _is_re THEN 'reasignacion' ELSE 'asignacion' END, 'solicitud', _request_id,
    jsonb_build_object('codigo', _req.code, 'responsable', _name));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.change_request_status(_request_id uuid, _new_status public.request_status, _comment text DEFAULT NULL)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _uid uuid := auth.uid(); _org uuid := public.current_org_id(); _old public.request_status;
  _admin boolean := public.is_org_admin(); _allowed boolean := false; _ntype text; _ntitle text;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id=_request_id AND organization_id=_org FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  _old := _req.status;
  IF _old = _new_status THEN RAISE EXCEPTION 'La solicitud ya se encuentra en ese estado'; END IF;
  IF NOT ((_old='pendiente' AND _new_status='cancelada')
       OR (_old='asignada' AND _new_status IN ('en_proceso','cancelada'))
       OR (_old='en_proceso' AND _new_status IN ('resuelta','cancelada'))
       OR (_old='resuelta' AND _new_status IN ('cerrada','en_proceso'))) THEN
    RAISE EXCEPTION 'Transición no permitida: % → %', public.status_label(_old), public.status_label(_new_status);
  END IF;
  IF _admin THEN _allowed := true;
  ELSIF _new_status IN ('en_proceso','resuelta') AND _old <> 'resuelta' AND _req.assignee_id = _uid THEN _allowed := true;
  ELSIF _new_status = 'cerrada' AND _req.requester_id = _uid AND (SELECT allow_requester_close FROM public.organizations WHERE id=_org) THEN _allowed := true;
  ELSIF _new_status = 'en_proceso' AND _old='resuelta' AND (_req.requester_id = _uid OR _req.assignee_id = _uid) THEN _allowed := true;
  ELSIF _new_status = 'cancelada' AND _req.requester_id = _uid AND _old IN ('pendiente','asignada') THEN _allowed := true;
  END IF;
  IF NOT _allowed THEN RAISE EXCEPTION 'No tiene permisos para realizar este cambio de estado'; END IF;
  IF _new_status = 'resuelta' AND (_comment IS NULL OR char_length(btrim(_comment)) < 3) THEN RAISE EXCEPTION 'Debe registrar una descripción de la resolución'; END IF;
  UPDATE public.requests SET status=_new_status,
    started_at = CASE WHEN _new_status='en_proceso' AND started_at IS NULL THEN now() ELSE started_at END,
    resolved_at = CASE WHEN _new_status='resuelta' THEN now() WHEN _new_status='en_proceso' THEN NULL ELSE resolved_at END,
    resolution_notes = CASE WHEN _new_status='resuelta' THEN btrim(_comment) ELSE resolution_notes END,
    closed_at = CASE WHEN _new_status='cerrada' THEN now() ELSE closed_at END,
    cancelled_at = CASE WHEN _new_status='cancelada' THEN now() ELSE cancelled_at END
  WHERE id=_request_id RETURNING * INTO _req;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, _uid,
    CASE _new_status WHEN 'en_proceso' THEN CASE WHEN _old='resuelta' THEN 'Reabierta' ELSE 'En proceso' END
      WHEN 'resuelta' THEN 'Resuelta' WHEN 'cerrada' THEN 'Cerrada' ELSE 'Cancelada' END,
    _old, _new_status, NULLIF(btrim(_comment),''));
  _ntype := CASE _new_status WHEN 'resuelta' THEN 'resuelta' WHEN 'cerrada' THEN 'cerrada' ELSE 'cambio_estado' END;
  _ntitle := _req.code || ': ' || public.status_label(_new_status);
  IF _req.requester_id <> _uid THEN PERFORM public._notify(_req.requester_id, _request_id, _ntype, _ntitle, _req.title); END IF;
  IF _req.assignee_id IS NOT NULL AND _req.assignee_id <> _uid THEN PERFORM public._notify(_req.assignee_id, _request_id, _ntype, _ntitle, _req.title); END IF;
  PERFORM public._audit(_org, CASE _new_status WHEN 'cerrada' THEN 'cierre' ELSE 'cambio_estado' END, 'solicitud', _request_id,
    jsonb_build_object('codigo', _req.code, 'de', _old, 'a', _new_status));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.change_request_priority(_request_id uuid, _priority public.request_priority)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _old public.request_priority; _org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'Solo un administrador puede cambiar la prioridad'; END IF;
  SELECT * INTO _req FROM public.requests WHERE id=_request_id AND organization_id=_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF _req.priority = _priority THEN RETURN _req; END IF;
  _old := _req.priority;
  UPDATE public.requests SET priority=_priority WHERE id=_request_id RETURNING * INTO _req;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, auth.uid(), 'Prioridad cambiada', _req.status, _req.status, _old::text || ' → ' || _priority::text);
  PERFORM public._audit(_org, 'edicion', 'solicitud', _request_id, jsonb_build_object('codigo', _req.code, 'prioridad_anterior', _old, 'prioridad', _priority));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.update_request_due(_request_id uuid, _due_at timestamptz)
RETURNS public.requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_org_admin() THEN RAISE EXCEPTION 'Solo un administrador puede cambiar la fecha límite'; END IF;
  UPDATE public.requests SET due_at=_due_at WHERE id=_request_id AND organization_id=_org RETURNING * INTO _req;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  DELETE FROM public.notifications WHERE request_id=_request_id AND type IN ('proxima_vencer','vencida');
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, auth.uid(), 'Fecha límite actualizada', _req.status, _req.status, to_char(_due_at AT TIME ZONE 'America/La_Paz', 'DD/MM/YYYY HH24:MI'));
  PERFORM public._audit(_org, 'edicion', 'solicitud', _request_id, jsonb_build_object('codigo', _req.code, 'fecha_limite', _due_at));
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.add_request_comment(_request_id uuid, _body text, _is_action boolean DEFAULT false)
RETURNS public.request_comments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests; _c public.request_comments; _uid uuid := auth.uid(); _name text;
BEGIN
  IF NOT public.can_access_request(_request_id) THEN RAISE EXCEPTION 'No tiene acceso a esta solicitud'; END IF;
  _body := btrim(_body);
  IF _body IS NULL OR char_length(_body) < 1 THEN RAISE EXCEPTION 'El comentario no puede estar vacío'; END IF;
  SELECT * INTO _req FROM public.requests WHERE id=_request_id;
  IF NOT (public.is_org_admin() OR _req.assignee_id = _uid OR _req.requester_id = _uid) THEN
    RAISE EXCEPTION 'Solo el solicitante, el responsable o un administrador pueden comentar'; END IF;
  IF _is_action AND NOT (public.is_org_admin() OR _req.assignee_id = _uid) THEN RAISE EXCEPTION 'Solo el responsable puede registrar acciones'; END IF;
  IF _req.status IN ('cerrada','cancelada') AND NOT public.is_org_admin() THEN RAISE EXCEPTION 'La solicitud ya está finalizada'; END IF;
  INSERT INTO public.request_comments(request_id, author_id, body, is_action) VALUES (_request_id, _uid, _body, _is_action) RETURNING * INTO _c;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (_request_id, _uid, CASE WHEN _is_action THEN 'Acción registrada' ELSE 'Comentario agregado' END, _req.status, _req.status, left(_body, 500));
  SELECT full_name INTO _name FROM public.profiles WHERE id=_uid;
  IF _req.requester_id <> _uid THEN PERFORM public._notify(_req.requester_id, _request_id, 'comentario', 'Nuevo comentario en ' || _req.code, _name || ': ' || left(_body,140)); END IF;
  IF _req.assignee_id IS NOT NULL AND _req.assignee_id <> _uid THEN PERFORM public._notify(_req.assignee_id, _request_id, 'comentario', 'Nuevo comentario en ' || _req.code, _name || ': ' || left(_body,140)); END IF;
  PERFORM public._audit(_req.organization_id, CASE WHEN _is_action THEN 'accion' ELSE 'comentario' END, 'solicitud', _request_id, jsonb_build_object('codigo', _req.code));
  RETURN _c;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_due_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id(); _hours int; _r record; _n int := 0; _admin record;
BEGIN
  IF _org IS NULL THEN RETURN 0; END IF;
  SELECT due_soon_hours INTO _hours FROM public.organizations WHERE id=_org;
  FOR _r IN SELECT * FROM public.requests WHERE organization_id=_org AND status IN ('pendiente','asignada','en_proceso')
            AND due_at < now() + make_interval(hours => _hours) LOOP
    IF _r.due_at < now() THEN
      PERFORM public._notify(_r.requester_id, _r.id, 'vencida', _r.code || ' vencida', _r.title);
      PERFORM public._notify(_r.assignee_id, _r.id, 'vencida', _r.code || ' vencida', _r.title);
      FOR _admin IN SELECT ur.user_id FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id
                    WHERE ur.role='admin' AND p.organization_id=_org AND p.is_active LOOP
        PERFORM public._notify(_admin.user_id, _r.id, 'vencida', _r.code || ' vencida', _r.title);
      END LOOP;
    ELSE
      PERFORM public._notify(_r.assignee_id, _r.id, 'proxima_vencer', _r.code || ' próxima a vencer', _r.title);
      PERFORM public._notify(_r.requester_id, _r.id, 'proxima_vencer', _r.code || ' próxima a vencer', _r.title);
    END IF;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.dashboard_stats(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id(); _uid uuid := auth.uid(); _scope text; _hours int; _res jsonb;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  _scope := CASE WHEN public.has_role(_uid,'admin') THEN 'admin' WHEN public.has_role(_uid,'responsable') THEN 'responsable' ELSE 'empleado' END;
  SELECT due_soon_hours INTO _hours FROM public.organizations WHERE id=_org;
  WITH base AS (
    SELECT r.*, d.name AS dep_name, t.name AS type_name, a.full_name AS assignee_name
    FROM public.requests r
    JOIN public.departments d ON d.id=r.department_id
    JOIN public.request_types t ON t.id=r.request_type_id
    LEFT JOIN public.profiles a ON a.id=r.assignee_id
    WHERE r.organization_id=_org
      AND (_from IS NULL OR r.created_at >= _from) AND (_to IS NULL OR r.created_at < _to)
      AND (_scope='admin' OR (_scope='responsable' AND r.assignee_id=_uid) OR (_scope='empleado' AND r.requester_id=_uid))
  ), open AS (SELECT * FROM base WHERE status IN ('pendiente','asignada','en_proceso'))
  SELECT jsonb_build_object(
    'scope', _scope,
    'total', (SELECT count(*) FROM base),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, c) FROM (SELECT status, count(*) c FROM base GROUP BY status) s), '{}'::jsonb),
    'open', (SELECT count(*) FROM open),
    'overdue', (SELECT count(*) FROM open WHERE due_at < now()),
    'due_soon', (SELECT count(*) FROM open WHERE due_at >= now() AND due_at < now() + make_interval(hours => _hours)),
    'avg_attention_hours', (SELECT round((avg(extract(epoch FROM (resolved_at - created_at)))/3600)::numeric, 1) FROM base WHERE resolved_at IS NOT NULL),
    'avg_response_hours', (SELECT round((avg(extract(epoch FROM (assigned_at - created_at)))/3600)::numeric, 1) FROM base WHERE assigned_at IS NOT NULL),
    'avg_resolution_hours', (SELECT round((avg(extract(epoch FROM (resolved_at - COALESCE(started_at, assigned_at, created_at))))/3600)::numeric, 1) FROM base WHERE resolved_at IS NOT NULL),
    'by_department', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', dep_name, 'value', c) ORDER BY c DESC) FROM (SELECT dep_name, count(*) c FROM base GROUP BY dep_name) x), '[]'::jsonb),
    'by_type', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', type_name, 'value', c) ORDER BY c DESC) FROM (SELECT type_name, count(*) c FROM base GROUP BY type_name) x), '[]'::jsonb),
    'by_priority', COALESCE((SELECT jsonb_object_agg(priority, c) FROM (SELECT priority, count(*) c FROM base GROUP BY priority) x), '{}'::jsonb),
    'by_assignee', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', COALESCE(assignee_name,'Sin asignar'), 'value', c, 'open', o, 'resolved', rs) ORDER BY c DESC)
        FROM (SELECT assignee_name, count(*) c, count(*) FILTER (WHERE status IN ('pendiente','asignada','en_proceso')) o,
              count(*) FILTER (WHERE status IN ('resuelta','cerrada')) rs FROM base GROUP BY assignee_name) x), '[]'::jsonb),
    'timeline', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'created', cr, 'resolved', rs) ORDER BY d)
        FROM (SELECT date_trunc('day', created_at)::date d, count(*) cr, count(*) FILTER (WHERE resolved_at IS NOT NULL) rs FROM base GROUP BY 1) x), '[]'::jsonb)
  ) INTO _res;
  RETURN _res;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_request, public.assign_request, public.change_request_status, public.change_request_priority,
  public.update_request_due, public.add_request_comment, public.refresh_due_alerts, public.dashboard_stats, public.log_event FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_request, public.assign_request, public.change_request_status, public.change_request_priority,
  public.update_request_due, public.add_request_comment, public.refresh_due_alerts, public.dashboard_stats, public.log_event TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE POLICY "attachments read accessible" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='attachments' AND public.can_access_request(((storage.foldername(name))[1])::uuid));
CREATE POLICY "attachments upload accessible" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='attachments' AND public.can_access_request(((storage.foldername(name))[1])::uuid));

INSERT INTO public.organizations(id,name,legal_name,tax_id,email,phone,address,website)
VALUES ('00000000-0000-0000-0000-000000000001','Empresa Demo S.R.L.','Empresa Demo Sociedad de Responsabilidad Limitada','1234567019','contacto@demo.com','+591 2 2123456','Av. 16 de Julio 1234, La Paz, Bolivia','https://demo.com')
ON CONFLICT DO NOTHING;
INSERT INTO public.departments(id,organization_id,name,description) VALUES
('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000001','Sistemas','Soporte técnico, redes y software'),
('00000000-0000-0000-0001-000000000002','00000000-0000-0000-0000-000000000001','Recursos Humanos','Personal, vacaciones y certificados'),
('00000000-0000-0000-0001-000000000003','00000000-0000-0000-0000-000000000001','Finanzas','Pagos, reembolsos y presupuestos'),
('00000000-0000-0000-0001-000000000004','00000000-0000-0000-0000-000000000001','Administración','Compras, insumos y servicios generales'),
('00000000-0000-0000-0001-000000000005','00000000-0000-0000-0000-000000000001','Mantenimiento','Infraestructura y reparaciones')
ON CONFLICT DO NOTHING;
INSERT INTO public.request_types(id,organization_id,name,description,default_department_id,sla_hours) VALUES
('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0000-000000000001','Soporte técnico','Problemas con equipos o software','00000000-0000-0000-0001-000000000001',NULL),
('00000000-0000-0000-0002-000000000002','00000000-0000-0000-0000-000000000001','Acceso a sistemas','Altas, bajas y permisos de usuarios','00000000-0000-0000-0001-000000000001',24),
('00000000-0000-0000-0002-000000000003','00000000-0000-0000-0000-000000000001','Vacaciones y permisos','Solicitud de vacaciones o licencias','00000000-0000-0000-0001-000000000002',72),
('00000000-0000-0000-0002-000000000004','00000000-0000-0000-0000-000000000001','Reembolso de gastos','Devolución de gastos laborales','00000000-0000-0000-0001-000000000003',120),
('00000000-0000-0000-0002-000000000005','00000000-0000-0000-0000-000000000001','Compra de insumos','Materiales de oficina y equipos','00000000-0000-0000-0001-000000000004',NULL),
('00000000-0000-0000-0002-000000000006','00000000-0000-0000-0000-000000000001','Reparación','Arreglos de infraestructura','00000000-0000-0000-0001-000000000005',NULL)
ON CONFLICT DO NOTHING;
INSERT INTO public.priority_settings(organization_id,priority,label,sla_hours) VALUES
('00000000-0000-0000-0000-000000000001','baja','Baja',120),
('00000000-0000-0000-0000-000000000001','media','Media',72),
('00000000-0000-0000-0000-000000000001','alta','Alta',24),
('00000000-0000-0000-0000-000000000001','critica','Crítica',4)
ON CONFLICT DO NOTHING;