-- Seed E2E staging (docnnernvp) — dopo reset_test_database.sql
-- Password admin: TestE2E2026!

BEGIN;

INSERT INTO public.organizations (id, name, slug, edition, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ristorante Test Pro',     'ristorante-test-pro',     'pro',     true),
  ('22222222-2222-2222-2222-222222222222', 'Ristorante Test Classic', 'ristorante-test-classic', 'classic', true);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'admin-pro@test.local',
    crypt('TestE2E2026!', gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '',
    false, false
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'admin-classic@test.local',
    crypt('TestE2E2026!', gen_salt('bf')), NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '',
    false, false
  );

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    jsonb_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'admin-pro@test.local'),
    'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW(), NOW()
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    jsonb_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'email', 'admin-classic@test.local'),
    'email', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW(), NOW(), NOW()
  );

INSERT INTO public.admin_users (email, name, tenant_id)
VALUES
  ('admin-pro@test.local',     'Admin Pro Test',     '11111111-1111-1111-1111-111111111111'),
  ('admin-classic@test.local', 'Admin Classic Test', '22222222-2222-2222-2222-222222222222');

INSERT INTO public.customers (tenant_id, name, email, source)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Anna Rossi',   'anna.rossi@example.com',   'manual'),
  ('11111111-1111-1111-1111-111111111111', 'Bruno Verdi',  'bruno.verdi@example.com',  'manual'),
  ('11111111-1111-1111-1111-111111111111', 'Carla Neri',   'carla.neri@example.com',   'manual');

INSERT INTO public.booking_requests (
  tenant_id, client_name, client_email, desired_date, num_guests, status, source, booking_source
)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'Luca Ferrari',  'luca@example.com',  CURRENT_DATE + 1, 4, 'pending',  'public_form', 'public'),
  ('22222222-2222-2222-2222-222222222222', 'Sara Conti',    'sara@example.com',  CURRENT_DATE + 2, 2, 'pending',  'public_form', 'public'),
  ('22222222-2222-2222-2222-222222222222', 'Marco Bianchi', 'marco@example.com', CURRENT_DATE + 3, 6, 'accepted', 'public_form', 'public');

COMMIT;
