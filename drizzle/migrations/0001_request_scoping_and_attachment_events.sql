-- Responsables only see requests assigned to them (admins see all; employees see their own)
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), 'admin')
           OR r.requester_id = auth.uid() OR r.assignee_id = auth.uid())
  )
$$;

DROP POLICY IF EXISTS "role scoped read requests" ON public.requests;
CREATE POLICY "role scoped read requests" ON public.requests FOR SELECT TO authenticated USING (
  organization_id = public.current_org_id() AND (
    public.has_role(auth.uid(),'admin') OR requester_id = auth.uid() OR assignee_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.on_attachment_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id = NEW.request_id;
  INSERT INTO public.request_status_history(request_id, actor_id, action, from_status, to_status, comment)
  VALUES (NEW.request_id, NEW.uploaded_by, 'Archivo adjuntado', _req.status, _req.status, NEW.file_name);
  IF _req.requester_id IS DISTINCT FROM NEW.uploaded_by THEN
    PERFORM public._notify(_req.requester_id, _req.id, 'adjunto', 'Nuevo archivo en ' || _req.code, NEW.file_name);
  END IF;
  IF _req.assignee_id IS NOT NULL AND _req.assignee_id IS DISTINCT FROM NEW.uploaded_by THEN
    PERFORM public._notify(_req.assignee_id, _req.id, 'adjunto', 'Nuevo archivo en ' || _req.code, NEW.file_name);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_attachment_added AFTER INSERT ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.on_attachment_added();