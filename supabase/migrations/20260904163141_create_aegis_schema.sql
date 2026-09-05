/*
# Project AEGIS — Full Schema Creation

## Purpose
Creates the complete database schema for Project AEGIS, a guardian protocol for agent-to-agent commerce. Single-tenant, no auth — all policies allow anon + authenticated.

## New Tables (8 total)
1. `merchant_products` — Product catalog for truth verification
2. `agent_actions` — Audit log of all agent financial actions
3. `fairness_scores` — Dark-pattern scoring results
4. `disputes` — Dispute records between agents
5. `collusion_alerts` — Price-fixing detection alerts
6. `consent_logs` — Immutable consent records
7. `agents` — Virtual agent registry for simulation
8. `payments` — Razorpay payment records

## Security
- RLS enabled on all tables.
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` — single-tenant demo with intentionally public data.
*/

-- 1. Merchant Products
CREATE TABLE IF NOT EXISTS merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text UNIQUE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE merchant_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_merchant_products" ON merchant_products;
CREATE POLICY "anon_select_merchant_products" ON merchant_products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_merchant_products" ON merchant_products;
CREATE POLICY "anon_insert_merchant_products" ON merchant_products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_merchant_products" ON merchant_products;
CREATE POLICY "anon_update_merchant_products" ON merchant_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_merchant_products" ON merchant_products;
CREATE POLICY "anon_delete_merchant_products" ON merchant_products FOR DELETE TO anon, authenticated USING (true);

-- 2. Agent Actions
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  user_id text,
  action_type text NOT NULL,
  amount numeric,
  timestamp timestamptz DEFAULT now(),
  verification_status text DEFAULT 'PENDING',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agent_actions" ON agent_actions;
CREATE POLICY "anon_select_agent_actions" ON agent_actions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_agent_actions" ON agent_actions;
CREATE POLICY "anon_insert_agent_actions" ON agent_actions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_agent_actions" ON agent_actions;
CREATE POLICY "anon_update_agent_actions" ON agent_actions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_agent_actions" ON agent_actions;
CREATE POLICY "anon_delete_agent_actions" ON agent_actions FOR DELETE TO anon, authenticated USING (true);

-- 3. Fairness Scores
CREATE TABLE IF NOT EXISTS fairness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_action_id uuid REFERENCES agent_actions(id) ON DELETE CASCADE,
  urgency_score integer NOT NULL DEFAULT 0,
  pressure_score integer NOT NULL DEFAULT 0,
  confusion_score integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  auto_escalate boolean NOT NULL DEFAULT false,
  keyword_matches jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE fairness_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_fairness_scores" ON fairness_scores;
CREATE POLICY "anon_select_fairness_scores" ON fairness_scores FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_fairness_scores" ON fairness_scores;
CREATE POLICY "anon_insert_fairness_scores" ON fairness_scores FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_fairness_scores" ON fairness_scores;
CREATE POLICY "anon_update_fairness_scores" ON fairness_scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_fairness_scores" ON fairness_scores;
CREATE POLICY "anon_delete_fairness_scores" ON fairness_scores FOR DELETE TO anon, authenticated USING (true);

-- 4. Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_agent_id text NOT NULL,
  seller_agent_id text NOT NULL,
  transaction_amount numeric NOT NULL DEFAULT 0,
  contract_terms text,
  delivery_evidence text,
  status text NOT NULL DEFAULT 'FILED',
  award_amount numeric NOT NULL DEFAULT 0,
  rationale text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_disputes" ON disputes;
CREATE POLICY "anon_select_disputes" ON disputes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_disputes" ON disputes;
CREATE POLICY "anon_insert_disputes" ON disputes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_disputes" ON disputes;
CREATE POLICY "anon_update_disputes" ON disputes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_disputes" ON disputes;
CREATE POLICY "anon_delete_disputes" ON disputes FOR DELETE TO anon, authenticated USING (true);

-- 5. Collusion Alerts
CREATE TABLE IF NOT EXISTS collusion_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL DEFAULT 'PRICE_FIXING',
  severity text NOT NULL DEFAULT 'MEDIUM',
  description text,
  agents_involved text[] DEFAULT '{}',
  market_price numeric NOT NULL DEFAULT 0,
  detected_price numeric NOT NULL DEFAULT 0,
  product_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE collusion_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_collusion_alerts" ON collusion_alerts;
CREATE POLICY "anon_select_collusion_alerts" ON collusion_alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_collusion_alerts" ON collusion_alerts;
CREATE POLICY "anon_insert_collusion_alerts" ON collusion_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_collusion_alerts" ON collusion_alerts;
CREATE POLICY "anon_update_collusion_alerts" ON collusion_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_collusion_alerts" ON collusion_alerts;
CREATE POLICY "anon_delete_collusion_alerts" ON collusion_alerts FOR DELETE TO anon, authenticated USING (true);

-- 6. Consent Logs
CREATE TABLE IF NOT EXISTS consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  original_terms text NOT NULL,
  simplified_terms text NOT NULL,
  user_acknowledged boolean NOT NULL DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_consent_logs" ON consent_logs;
CREATE POLICY "anon_select_consent_logs" ON consent_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_consent_logs" ON consent_logs;
CREATE POLICY "anon_insert_consent_logs" ON consent_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_consent_logs" ON consent_logs;
CREATE POLICY "anon_update_consent_logs" ON consent_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_consent_logs" ON consent_logs;
CREATE POLICY "anon_delete_consent_logs" ON consent_logs FOR DELETE TO anon, authenticated USING (true);

-- 7. Agents
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  behavior text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_agents" ON agents;
CREATE POLICY "anon_select_agents" ON agents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_agents" ON agents;
CREATE POLICY "anon_insert_agents" ON agents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_agents" ON agents;
CREATE POLICY "anon_update_agents" ON agents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_agents" ON agents;
CREATE POLICY "anon_delete_agents" ON agents FOR DELETE TO anon, authenticated USING (true);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  payment_id text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'CREATED',
  dispute_id uuid REFERENCES disputes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created ON agent_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_collusion_alerts_severity ON collusion_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_consent_logs_user ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
