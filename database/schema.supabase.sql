-- ==========================================================
-- ChatModz Supabase / PostgreSQL Database Schema
-- Run this complete script in the Supabase Dashboard -> SQL Editor
-- ==========================================================

-- Enable pgcrypto for UUID & cryptographic hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Operators Table
CREATE TABLE IF NOT EXISTS public.operators (
  id BIGSERIAL PRIMARY KEY,
  public_id VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'operator' CHECK (role IN ('operator', 'admin')),
  status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'training', 'active', 'suspended', 'rejected')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operator Applications
CREATE TABLE IF NOT EXISTS public.operator_applications (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  location VARCHAR(160),
  experience TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'training', 'active', 'rejected')),
  reviewed_by BIGINT REFERENCES public.operators(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Operator Activation Codes
CREATE TABLE IF NOT EXISTS public.operator_activation_codes (
  id BIGSERIAL PRIMARY KEY,
  operator_id BIGINT NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Connected Sites
CREATE TABLE IF NOT EXISTS public.sites (
  id BIGSERIAL PRIMARY KEY,
  internal_name VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disconnected')),
  integration_type VARCHAR(40) NOT NULL DEFAULT 'hybrid' CHECK (integration_type IN ('inbound', 'outbound', 'hybrid', 'webhook', 'api')),
  signing_secret_hash CHAR(64),
  secret_env_key VARCHAR(160),
  endpoint_base_url VARCHAR(500),
  member_photo_url VARCHAR(500),
  managed_profile_photo_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  external_conversation_id VARCHAR(255) NOT NULL,
  member_alias VARCHAR(160) NOT NULL,
  managed_profile_alias VARCHAR(160) NOT NULL,
  managed_profile_external_id VARCHAR(255),
  member_photo_url VARCHAR(500),
  managed_profile_photo_url VARCHAR(500),
  priority VARCHAR(40) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  status VARCHAR(40) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  assigned_operator_id BIGINT REFERENCES public.operators(id) ON DELETE SET NULL,
  lock_expires_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_external_unique UNIQUE (site_id, external_conversation_id)
);

-- 6. Conversation Assignments
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  operator_id BIGINT NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMPTZ
);

-- 7. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_message_id VARCHAR(255),
  sender_type VARCHAR(40) NOT NULL CHECK (sender_type IN ('member', 'managed_profile', 'system')),
  body TEXT NOT NULL,
  media_proxy_url VARCHAR(500),
  media_type VARCHAR(40),
  delivery_status VARCHAR(40) NOT NULL DEFAULT 'received' CHECK (delivery_status IN ('received', 'queued', 'delivered', 'failed')),
  sent_by_operator_id BIGINT REFERENCES public.operators(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT messages_external_unique UNIQUE (conversation_id, external_message_id)
);

-- 8. Operator Push Subscriptions
CREATE TABLE IF NOT EXISTS public.operator_push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  operator_id BIGINT NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Integration Deliveries
CREATE TABLE IF NOT EXISTS public.integration_deliveries (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  direction VARCHAR(40) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  external_event_id VARCHAR(255) NOT NULL,
  conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'delivered', 'failed')),
  attempt_count INT NOT NULL DEFAULT 0,
  error_message VARCHAR(500),
  payload_json JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMPTZ,
  CONSTRAINT deliveries_event_unique UNIQUE (site_id, direction, external_event_id)
);

-- 10. Operator Activity
CREATE TABLE IF NOT EXISTS public.operator_activity (
  id BIGSERIAL PRIMARY KEY,
  operator_id BIGINT NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  activity_type VARCHAR(40) NOT NULL CHECK (activity_type IN ('login', 'claim', 'release', 'reply', 'logout', 'training')),
  conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE SET NULL,
  site_id BIGINT REFERENCES public.sites(id) ON DELETE SET NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_operator_id BIGINT REFERENCES public.operators(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT,
  ip_address VARCHAR(45),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_operators_status ON public.operators(status);
CREATE INDEX IF NOT EXISTS idx_applications_status_created ON public.operator_applications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_queue ON public.conversations(status, assigned_operator_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON public.messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_status_received ON public.integration_deliveries(status, received_at);
CREATE INDEX IF NOT EXISTS idx_activity_operator_created ON public.operator_activity(operator_id, created_at);

-- Row Level Security (RLS) Configuration
-- For ChatModz backend API operations with the Service Role Key or Anon Key:
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow full access to backend operations (service_role and anon through API proxy)
DROP POLICY IF EXISTS "allow_all_operators" ON public.operators;
CREATE POLICY "allow_all_operators" ON public.operators FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_applications" ON public.operator_applications;
CREATE POLICY "allow_all_applications" ON public.operator_applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_activation_codes" ON public.operator_activation_codes;
CREATE POLICY "allow_all_activation_codes" ON public.operator_activation_codes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_sites" ON public.sites;
CREATE POLICY "allow_all_sites" ON public.sites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_conversations" ON public.conversations;
CREATE POLICY "allow_all_conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_assignments" ON public.conversation_assignments;
CREATE POLICY "allow_all_assignments" ON public.conversation_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_messages" ON public.messages;
CREATE POLICY "allow_all_messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_push_subscriptions" ON public.operator_push_subscriptions;
CREATE POLICY "allow_all_push_subscriptions" ON public.operator_push_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_deliveries" ON public.integration_deliveries;
CREATE POLICY "allow_all_deliveries" ON public.integration_deliveries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_activity" ON public.operator_activity;
CREATE POLICY "allow_all_activity" ON public.operator_activity FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_audit" ON public.audit_log;
CREATE POLICY "allow_all_audit" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- ==========================================================
-- Default Seed Data
-- ==========================================================

-- 1. Initial Administrator Account
-- Email: admin@chatmodz.io
-- Password: admin12345
INSERT INTO public.operators (id, public_id, full_name, email, password_hash, role, status, last_active_at)
VALUES (
  1,
  'cmz_admin_001',
  'Operations Director',
  'admin@chatmodz.io',
  '$2b$10$Oi4.CChfJSqWZYt3buRvsO76f2V5yzb2l9MKH6lciswo7bVCt.9aa',
  'admin',
  'active',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 2. Initial Active Operator
-- Email: operator@chatmodz.io
-- Password: operator12345
INSERT INTO public.operators (id, public_id, full_name, email, password_hash, role, status, last_active_at)
VALUES (
  2,
  'cmz_oper_002',
  'Sarah Jenkins',
  'operator@chatmodz.io',
  '$2b$10$CXZaes/qxxn2iBGFdkZdp.N/YFEh4bDXPfn72XUyfiwblZ7yy/v6O',
  'operator',
  'active',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 3. Initial Connected Sites
INSERT INTO public.sites (id, internal_name, display_name, status, integration_type, endpoint_base_url, secret_env_key)
VALUES 
  (1, 'cupid_connect', 'CupidConnect UK', 'active', 'hybrid', 'https://api.cupidconnect.example/v1/replies', 'CHATMODZ_CUPID_SECRET'),
  (2, 'velvet_match', 'Velvet Match US', 'active', 'hybrid', 'https://api.velvetmatch.example/webhook', 'CHATMODZ_VELVET_SECRET'),
  (3, 'rose_romance', 'Rose Romance EU', 'active', 'hybrid', 'https://api.roseromance.example/dispatch', 'CHATMODZ_ROSE_SECRET')
ON CONFLICT (internal_name) DO NOTHING;

-- 4. Initial Operator Applications
INSERT INTO public.operator_applications (id, full_name, email, location, experience, status)
VALUES 
  (1, 'Natasha Romanoff', 'natasha.chat@example.com', 'Manchester, UK', '3 years experience in high-volume community moderation and live customer engagement. Fast typing speed and native English fluency.', 'pending'),
  (2, 'Julian Martinez', 'julian.m@example.com', 'Toronto, Canada', 'Experienced live chat specialist with background in dating & social app community retention. Available for evening shifts.', 'pending'),
  (3, 'Amina Diallo', 'amina.d@example.com', 'Paris, France', 'Bilingual community support specialist. Strong adherence to persona guidelines and privacy compliance.', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs
SELECT setval('public.operators_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.operators));
SELECT setval('public.sites_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.sites));
SELECT setval('public.operator_applications_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.operator_applications));
