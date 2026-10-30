-- Transactional corrections. Preserve account IDs, passwords, money and contracts.
CREATE OR REPLACE FUNCTION correct_jktl_record(p_kind text,p_id uuid,p_expected jsonb,p_changes jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old_profile jsonb; linked_user uuid; actor_role text; actor_disabled timestamptz; actor_revoked timestamptz;
 new_email text; email_changed boolean; role_changed boolean:=false; linked_profiles uuid[]; team_profiles uuid[]; old_role text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('jktl-record-corrections'));
 -- Lock team rows in a stable order before checking role/last-owner constraints.
 PERFORM id FROM admin_users ORDER BY id FOR UPDATE;
 SELECT role,disabled_at,staff_revoked_at INTO actor_role,actor_disabled,actor_revoked FROM admin_users WHERE id=p_actor;
 IF actor_role IS NULL OR actor_disabled IS NOT NULL OR actor_revoked IS NOT NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_kind IN('affiliate','partner') THEN
  IF actor_role NOT IN('owner','affiliate_manager') THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object('name',name,'email',email,'note',application_note) INTO old_profile FROM affiliates WHERE id=p_id AND programme=p_kind FOR UPDATE;
  SELECT user_id INTO linked_user FROM distribution_account_links WHERE affiliate_id=p_id;
 ELSIF p_kind='team' THEN
  IF actor_role<>'owner' THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object('name',name,'email',email,'role',role),business_user_id,role INTO old_profile,linked_user,old_role FROM admin_users WHERE id=p_id FOR UPDATE;
 ELSIF p_kind='customClient' THEN
  IF actor_role<>'owner' THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT jsonb_build_object('businessName',o.name,'name',u.name,'email',u.email,'phone',COALESCE(u.phone,'')),c.user_id INTO old_profile,linked_user FROM custom_clients c JOIN organizations o ON o.id=c.organization_id JOIN users u ON u.id=c.user_id WHERE c.organization_id=p_id FOR UPDATE OF c,o,u;
 ELSE RAISE EXCEPTION 'Invalid record type'; END IF;
 IF old_profile IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 IF old_profile IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Record changed. Reload before saving.'; END IF;
 IF jsonb_typeof(p_changes)<>'object' OR NOT(p_changes ?& ARRAY(SELECT jsonb_object_keys(old_profile))) OR NOT(p_changes?'name') OR NOT(p_changes?'email') OR EXISTS(SELECT 1 FROM jsonb_each(p_changes) a WHERE jsonb_typeof(a.value)<>'string') THEN RAISE EXCEPTION 'Invalid profile details'; END IF;
 IF length(trim(p_changes->>'name')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Enter a valid name'; END IF;
 new_email:=lower(trim(p_changes->>'email'));
 IF length(new_email)>254 OR new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
 email_changed:=new_email IS DISTINCT FROM lower(old_profile->>'email');
 IF NOT email_changed THEN new_email:=old_profile->>'email'; END IF;
 IF email_changed AND actor_role<>'owner' THEN RAISE EXCEPTION 'Only an owner can correct sign-in email addresses'; END IF;
 IF p_kind IN('affiliate','partner') AND (p_changes-ARRAY['name','email','note'])<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid profile fields'; END IF;
 IF p_kind='team' THEN
  IF (p_changes-ARRAY['name','email','role'])<>'{}'::jsonb OR p_changes->>'role' NOT IN('owner','affiliate_manager','analyst','writer','editor','support','growth_gaming_lead') THEN RAISE EXCEPTION 'Select a valid team role'; END IF;
  role_changed:=old_role IS DISTINCT FROM p_changes->>'role';
  IF role_changed AND p_id=p_actor THEN RAISE EXCEPTION 'You cannot change your own team role'; END IF;
  IF role_changed AND old_role='owner' AND EXISTS(SELECT 1 FROM admin_users WHERE id=p_id AND disabled_at IS NULL AND staff_revoked_at IS NULL) AND NOT EXISTS(SELECT 1 FROM admin_users WHERE id<>p_id AND role='owner' AND disabled_at IS NULL AND staff_revoked_at IS NULL) THEN RAISE EXCEPTION 'Keep at least one active owner'; END IF;
 END IF;
 IF p_kind='customClient' AND ((p_changes-ARRAY['businessName','name','email','phone'])<>'{}'::jsonb OR length(trim(p_changes->>'businessName')) NOT BETWEEN 1 AND 200 OR length(COALESCE(p_changes->>'phone',''))>50) THEN RAISE EXCEPTION 'Enter valid client details'; END IF;
 IF length(COALESCE(p_changes->>'note',''))>3000 THEN RAISE EXCEPTION 'Profile note is too long'; END IF;
 IF linked_user IS NOT NULL THEN
  PERFORM id FROM users WHERE id=linked_user FOR UPDATE;
  SELECT COALESCE(array_agg(affiliate_id),ARRAY[]::uuid[]) INTO linked_profiles FROM distribution_account_links WHERE user_id=linked_user;
  SELECT COALESCE(array_agg(id),ARRAY[]::uuid[]) INTO team_profiles FROM admin_users WHERE business_user_id=linked_user;
 ELSE linked_profiles:=ARRAY[]::uuid[];team_profiles:=ARRAY[]::uuid[]; END IF;
 IF p_kind IN('affiliate','partner') AND NOT(p_id=ANY(linked_profiles)) THEN linked_profiles:=array_append(linked_profiles,p_id); END IF;
 IF p_kind='team' AND NOT(p_id=ANY(team_profiles)) THEN team_profiles:=array_append(team_profiles,p_id); END IF;
 IF email_changed THEN
  IF EXISTS(SELECT 1 FROM users WHERE lower(email)=new_email AND id IS DISTINCT FROM linked_user) THEN RAISE EXCEPTION 'That email belongs to another Business account; accounts cannot be merged by editing'; END IF;
  IF EXISTS(SELECT 1 FROM admin_users WHERE lower(email)=new_email AND NOT(id=ANY(team_profiles))) AND cardinality(team_profiles)>0 THEN RAISE EXCEPTION 'That email belongs to another team account'; END IF;
  IF EXISTS(SELECT 1 FROM affiliates a WHERE a.id=ANY(linked_profiles) AND EXISTS(SELECT 1 FROM affiliates b WHERE b.programme=a.programme AND lower(b.email)=new_email AND NOT(b.id=ANY(linked_profiles)))) THEN RAISE EXCEPTION 'That email belongs to another programme account'; END IF;
  IF linked_user IS NOT NULL THEN UPDATE users SET email=new_email WHERE id=linked_user; UPDATE organization_members SET email=new_email WHERE user_id=linked_user; END IF;
  UPDATE affiliates SET email=new_email WHERE id=ANY(linked_profiles);
  UPDATE admin_users SET email=new_email WHERE id=ANY(team_profiles);
 END IF;
 IF p_kind IN('affiliate','partner') THEN UPDATE affiliates SET name=trim(p_changes->>'name'),email=new_email,application_note=COALESCE(p_changes->>'note','') WHERE id=p_id;
 ELSIF p_kind='team' THEN UPDATE admin_users SET name=trim(p_changes->>'name'),email=new_email,role=p_changes->>'role',permission_overrides=CASE WHEN role_changed THEN '{}'::jsonb ELSE permission_overrides END WHERE id=p_id;
 ELSE UPDATE organizations SET name=trim(p_changes->>'businessName') WHERE id=p_id;UPDATE business_profiles SET display_name=trim(p_changes->>'businessName') WHERE organization_id=p_id AND display_name=old_profile->>'businessName';UPDATE users SET name=trim(p_changes->>'name'),phone=COALESCE(p_changes->>'phone','') WHERE id=linked_user;UPDATE organization_members SET name=trim(p_changes->>'name') WHERE user_id=linked_user AND name=old_profile->>'name'; END IF;
 IF email_changed OR role_changed THEN
  DELETE FROM sessions WHERE user_id=linked_user;
  DELETE FROM admin_sessions WHERE admin_user_id=ANY(team_profiles);
  DELETE FROM affiliate_sessions WHERE affiliate_id=ANY(linked_profiles);
  UPDATE editorial_invitations SET revoked_at=now() WHERE user_id=ANY(team_profiles) AND accepted_at IS NULL AND revoked_at IS NULL;
 END IF;
 IF email_changed THEN
  UPDATE password_reset_tokens SET used_at=now() WHERE user_id=linked_user AND used_at IS NULL;
  UPDATE affiliate_password_resets SET used_at=now() WHERE affiliate_id=ANY(linked_profiles) AND used_at IS NULL;
  UPDATE custom_invitations SET used_at=now(),revoked_at=now() WHERE user_id=linked_user AND used_at IS NULL;
  UPDATE affiliate_invitations SET revoked_at=now() WHERE accepted_at IS NULL AND revoked_at IS NULL AND (affiliate_id=ANY(linked_profiles) OR (lower(email)=lower(old_profile->>'email') AND (linked_user IS NOT NULL OR program=p_kind)));
 END IF;
 INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail) VALUES(p_actor::text,'RECORD_DETAILS_CORRECTED',CASE WHEN p_kind IN('affiliate','partner') THEN p_id ELSE NULL END,jsonb_build_object('kind',p_kind,'record',p_id,'before',old_profile,'after',p_changes||jsonb_build_object('email',new_email),'linkedUserId',linked_user,'sessionsRevoked',email_changed OR role_changed));
 IF p_kind='customClient' THEN INSERT INTO custom_audit(organization_id,actor_id,event,detail) VALUES(p_id,p_actor::text,'CLIENT_DETAILS_CORRECTED',jsonb_build_object('before',old_profile,'after',p_changes||jsonb_build_object('email',new_email))); END IF;
 RETURN jsonb_build_object('details',p_changes||jsonb_build_object('email',new_email),'sessionsRevoked',email_changed OR role_changed);
END $$;
