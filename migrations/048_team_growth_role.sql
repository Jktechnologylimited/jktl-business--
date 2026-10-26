-- Permit the standard Team account-creation flow as well as existing linked staff.
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS growth_staff_identity_check;
