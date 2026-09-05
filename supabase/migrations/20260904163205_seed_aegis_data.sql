/*
# Project AEGIS — Seed Mock Data

## Purpose
Seeds the database with mock data for the AEGIS platform:
- 10 merchant products (P001-P010)
- 5 virtual agents with different roles and behaviors
- Sample agent actions, fairness scores, disputes, collusion alerts, and consent logs

## Tables Populated
1. `merchant_products` — 10 products with realistic prices, stock, discounts
2. `agents` — 5 agents: Buyer, Seller, Supplier, Auditor, Arbitrator
3. `agent_actions` — Sample actions for dashboard hydration
4. `fairness_scores` — Sample dark-pattern scores
5. `disputes` — Sample dispute with award
6. `collusion_alerts` — 3 colluding agents pricing above market
7. `consent_logs` — Sample consent record with hash
*/

-- Products (idempotent via ON CONFLICT)
INSERT INTO merchant_products (product_id, name, price, stock, discount) VALUES
  ('P001', 'Wireless Earbuds Pro', 2999, 150, 10),
  ('P002', 'Smart Watch Series 6', 8999, 80, 15),
  ('P003', 'Bluetooth Speaker Mini', 1499, 200, 5),
  ('P004', 'USB-C Fast Charger 65W', 999, 500, 0),
  ('P005', 'Laptop Stand Aluminum', 1799, 120, 20),
  ('P006', 'Mechanical Keyboard RGB', 3499, 60, 10),
  ('P007', 'HD Webcam 1080p', 2299, 90, 25),
  ('P008', 'Portable SSD 1TB', 6499, 40, 0),
  ('P009', 'Noise Cancelling Headphones', 7999, 35, 15),
  ('P010', 'Phone Gimbal Stabilizer', 3299, 75, 10)
ON CONFLICT (product_id) DO NOTHING;

-- Agents
INSERT INTO agents (agent_id, name, role, behavior, status) VALUES
  ('A1', 'Agent-A1', 'Buyer', 'Negotiates prices, verifies claims, files disputes', 'ACTIVE'),
  ('A2', 'Agent-A2', 'Seller', 'Lists products, offers discounts, processes orders', 'ACTIVE'),
  ('A3', 'Agent-A3', 'Supplier', 'Supplies inventory, sets market prices', 'ACTIVE'),
  ('A4', 'Agent-A4', 'Auditor', 'Monitors fairness, checks compliance, escalates issues', 'ACTIVE'),
  ('A5', 'Agent-A5', 'Arbitrator', 'Resolves disputes, awards compensation, enforces contracts', 'ACTIVE')
ON CONFLICT (agent_id) DO NOTHING;

-- Sample agent actions
INSERT INTO agent_actions (agent_id, user_id, action_type, amount, verification_status) VALUES
  ('A2', 'U001', 'CLAIM_DISCOUNT', 2999, 'VERIFIED'),
  ('A2', 'U002', 'CLAIM_PRICE', 8999, 'HALLUCINATION_DETECTED'),
  ('A1', 'U003', 'PURCHASE', 1499, 'VERIFIED'),
  ('A2', 'U004', 'CLAIM_STOCK', 0, 'VERIFIED'),
  ('A1', 'U005', 'PURCHASE', 3499, 'VERIFIED'),
  ('A2', 'U006', 'CLAIM_DISCOUNT', 1799, 'HALLUCINATION_DETECTED'),
  ('A1', 'U007', 'PURCHASE', 6499, 'VERIFIED'),
  ('A2', 'U008', 'CLAIM_PRICE', 2299, 'VERIFIED'),
  ('A4', 'U009', 'FAIRNESS_CHECK', 0, 'ESCALATED'),
  ('A5', 'U010', 'DISPUTE_ARBITRATION', 500, 'RESOLVED'),
  ('A1', 'U011', 'PURCHASE', 7999, 'VERIFIED'),
  ('A2', 'U012', 'CLAIM_DISCOUNT', 3299, 'VERIFIED'),
  ('A4', 'U013', 'COLLUSION_CHECK', 0, 'ALERT_RAISED'),
  ('A1', 'U014', 'PURCHASE', 999, 'VERIFIED'),
  ('A2', 'U015', 'CLAIM_STOCK', 0, 'HALLUCINATION_DETECTED'),
  ('A1', 'U016', 'PURCHASE', 2999, 'VERIFIED'),
  ('A4', 'U017', 'FAIRNESS_CHECK', 0, 'VERIFIED')
ON CONFLICT DO NOTHING;

-- Sample fairness score (linked to first fairness check action)
INSERT INTO fairness_scores (agent_action_id, urgency_score, pressure_score, confusion_score, total_score, auto_escalate, keyword_matches)
SELECT id, 75, 80, 60, 215, true, '["only", "left", "limited", "buy now", "expires"]'::jsonb
FROM agent_actions WHERE action_type = 'FAIRNESS_CHECK' AND verification_status = 'ESCALATED'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Sample dispute
INSERT INTO disputes (buyer_agent_id, seller_agent_id, transaction_amount, contract_terms, delivery_evidence, status, award_amount, rationale)
VALUES ('A1', 'A2', 5000, 'Delivery within 48 hours or 10% compensation', 'Delivery took 96 hours - 2x delay', 'RESOLVED', 500, 'Contract breached: delivery exceeded 48h SLA by 48 hours. 10% compensation awarded to buyer.')
ON CONFLICT DO NOTHING;

-- Sample collusion alert
INSERT INTO collusion_alerts (alert_type, severity, description, agents_involved, market_price, detected_price, product_id)
VALUES ('PRICE_FIXING', 'CRITICAL', '3 agents pricing above market rate by ₹50 (11.1% markup). Collusion pattern detected.', ARRAY['A2', 'A3', 'A1'], 450, 500, 'P003')
ON CONFLICT DO NOTHING;

-- Sample consent log
INSERT INTO consent_logs (user_id, original_terms, simplified_terms, user_acknowledged, hash)
VALUES ('U001', 'By proceeding with this transaction you acknowledge that the seller agent may utilize dynamic pricing algorithms and that all disputes shall be resolved through binding arbitration within the AEGIS protocol framework.', 'You agree that: 1) The seller can change prices, 2) Any disputes will be resolved by AEGIS, 3) Your purchase is final once confirmed.', true, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
ON CONFLICT DO NOTHING;
