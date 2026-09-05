export interface MerchantProduct {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock: number;
  discount: number;
}

export interface AgentAction {
  id: string;
  agent_id: string;
  user_id: string | null;
  action_type: string;
  amount: number | null;
  timestamp: string;
  verification_status: string;
  created_at: string;
}

export interface FairnessScore {
  id: string;
  agent_action_id: string | null;
  urgency_score: number;
  pressure_score: number;
  confusion_score: number;
  total_score: number;
  auto_escalate: boolean;
  keyword_matches: string[];
  created_at: string;
}

export interface Dispute {
  id: string;
  buyer_agent_id: string;
  seller_agent_id: string;
  transaction_amount: number;
  contract_terms: string | null;
  delivery_evidence: string | null;
  status: string;
  award_amount: number;
  rationale: string | null;
  created_at: string;
}

export interface CollusionAlert {
  id: string;
  alert_type: string;
  severity: string;
  description: string | null;
  agents_involved: string[];
  market_price: number;
  detected_price: number;
  product_id: string | null;
  created_at: string;
}

export interface ConsentLog {
  id: string;
  user_id: string;
  original_terms: string;
  simplified_terms: string;
  user_acknowledged: boolean;
  timestamp: string;
  hash: string;
  created_at: string;
}

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  role: string;
  behavior: string | null;
  status: string;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string | null;
  payment_id: string | null;
  amount: number;
  currency: string;
  status: string;
  dispute_id: string | null;
  created_at: string;
}

export interface TruthCheckResult {
  is_verified: boolean;
  actual_value: number;
  claimed_value: number;
  discrepancy: number;
  rationale: string;
  verdict: string;
  product: MerchantProduct | null;
}

export interface FairnessResult {
  urgency_score: number;
  pressure_score: number;
  confusion_score: number;
  total_score: number;
  auto_escalate: boolean;
  keyword_matches: string[];
  verdict: string;
}

export interface DisputeResult {
  dispute_id: string;
  status: string;
  award_amount: number;
  rationale: string;
  verdict: string;
}

export interface CollusionResult {
  is_collusion: boolean;
  severity: string;
  agents_involved: string[];
  market_price: number;
  detected_price: number;
  description: string;
  verdict: string;
}

export interface ConsentResult {
  simplified_terms: string;
  hash: string;
  user_acknowledged: boolean;
  verdict: string;
}

export interface CommerceResult {
  product: MerchantProduct | null;
  list_price: number;
  negotiated_price: number;
  discount_applied: number;
  order_id: string;
  payment_id: string;
  payment_status: string;
  revenue: number;
  negotiation_steps: string[];
  verdict: string;
}

export interface ActivityEvent {
  id: string;
  pillar: string;
  action: string;
  verdict: string;
  timestamp: string;
}
