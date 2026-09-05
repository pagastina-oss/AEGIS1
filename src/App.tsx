import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Scale, Gavel, Network, FileCheck, Activity, AlertTriangle,
  CheckCircle2, Database, Bot, CreditCard, Settings, BookOpen, Menu, X,
  Play, Loader2, TrendingUp, Lock, Zap, Sun, Moon, ShoppingBag, IndianRupee
} from 'lucide-react';
import { supabase } from './lib/supabase';
import type {
  MerchantProduct, AgentAction, CollusionAlert, Agent, Payment,
  TruthCheckResult, FairnessResult, DisputeResult, CollusionResult, ConsentResult,
  CommerceResult, ActivityEvent
} from './lib/types';
import { verifyClaim } from './lib/pillars/truthChecker';
import { analyzeFairness } from './lib/pillars/fairnessOracle';
import { fileDispute } from './lib/pillars/disputeArbitrator';
import { analyzePrices } from './lib/pillars/collisionDetector';
import { simplifyAndLog } from './lib/pillars/consentOracle';
import { executePurchase } from './lib/pillars/commerceAgent';
import { createOrder, capturePayment, refundPayment, getPayments } from './lib/razorpay';
import ResultRenderer from './components/ResultRenderer';

type View = 'dashboard' | 'pillars' | 'agents' | 'settings';
type PillarKey = 'truth' | 'fairness' | 'dispute' | 'collision' | 'consent' | 'commerce';
type Result = TruthCheckResult | FairnessResult | DisputeResult | CollusionResult | ConsentResult | CommerceResult | null;

const PILLARS = [
  { key: 'truth' as PillarKey, title: 'Truth Checker', subtitle: 'Anti-Hallucination', icon: Shield, color: 'purple', desc: 'Verify agent claims against merchant catalog' },
  { key: 'fairness' as PillarKey, title: 'Fairness Oracle', subtitle: 'Anti-Dark Pattern', icon: Scale, color: 'amber', desc: 'Score conversations for manipulative patterns' },
  { key: 'dispute' as PillarKey, title: 'Dispute Arbitrator', subtitle: 'Dispute Resolution', icon: Gavel, color: 'green', desc: 'File and arbitrate inter-agent disputes' },
  { key: 'collision' as PillarKey, title: 'Collision Detector', subtitle: 'Anti-Collusion', icon: Network, color: 'red', desc: 'Detect price fixing across multiple agents' },
  { key: 'consent' as PillarKey, title: 'Consent Oracle', subtitle: 'User Understanding', icon: FileCheck, color: 'blue', desc: 'Simplify terms and log user consent' },
  { key: 'commerce' as PillarKey, title: 'Commerce Agent', subtitle: 'Revenue Generation', icon: ShoppingBag, color: 'cyan', desc: 'AI buyer completes purchases end-to-end via Razorpay' },
];

const SAMPLE_CONVERSATION = 'Hurry! Only 3 left in stock! This is a limited time offer that expires today! Buy now before its gone! Act now - final hours! Subscription auto-renews. Terms apply and may vary. Bundled with extra features subject to conditions.';
const SAMPLE_TERMS = 'By proceeding with this transaction you acknowledge that the seller agent may utilize dynamic pricing algorithms and that all disputes shall be resolved through binding arbitration within the AEGIS protocol framework. Your subscription will auto-renew unless cancelled. Terms and conditions apply and may vary without prior notice. You hereby indemnify and hold harmless the seller for any damages incurred pursuant to this agreement.';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dbConnected, setDbConnected] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [activeResult, setActiveResult] = useState<{ key: PillarKey; result: Result } | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [metrics, setMetrics] = useState({ actions: 0, threats: 0, trust: 0, agents: 0, revenue: 0 });
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<CollusionAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [truthForm, setTruthForm] = useState({ productId: 'P001', claimType: 'discount' as 'discount' | 'price' | 'stock', claimedValue: '25' });
  const [fairnessForm, setFairnessForm] = useState({ conversation: SAMPLE_CONVERSATION });
  const [disputeForm, setDisputeForm] = useState({ buyer: 'A1', seller: 'A2', amount: '5000', terms: 'Delivery within 48 hours or 10% compensation', evidence: 'Delivery took 96 hours - 2x delay' });
  const [collisionForm, setCollisionForm] = useState({ productId: 'P003', marketPrice: '450', agentPrices: [{ agentId: 'A2', price: '500' }, { agentId: 'A3', price: '500' }, { agentId: 'A1', price: '500' }] });
  const [consentForm, setConsentForm] = useState({ userId: 'U001', terms: SAMPLE_TERMS, acknowledged: true });
  const [commerceForm, setCommerceForm] = useState({ productId: 'P001', budget: '5000' });
  const [commerceLog, setCommerceLog] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '5000' });
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [negotiationLog, setNegotiationLog] = useState<string[]>([]);

  const addActivity = useCallback((pillar: string, action: string, verdict: string) => {
    const event: ActivityEvent = {
      id: `${Date.now()}-${Math.random()}`,
      pillar, action, verdict,
      timestamp: new Date().toISOString(),
    };
    setActivity((prev) => [event, ...prev].slice(0, 20));
  }, []);

  const refreshMetrics = useCallback(async () => {
    const [actionsRes, alertsRes, agentsRes] = await Promise.all([
      supabase.from('agent_actions').select('*', { count: 'exact', head: true }),
      supabase.from('collusion_alerts').select('*', { count: 'exact', head: true }),
      supabase.from('agents').select('*', { count: 'exact', head: true }),
    ]);

    const actions = actionsRes.count || 0;
    const threats = (alertsRes.count || 0) + (actionsRes.data?.filter((a: AgentAction) => a.verification_status === 'HALLUCINATION_DETECTED').length || 0);
    const trust = actions > 0 ? Math.round((1 - threats / actions) * 100) : 0;

    const { data: revenueData } = await supabase.from('agent_actions').select('amount').eq('action_type', 'COMMERCE_PURCHASE').eq('verification_status', 'PURCHASE_COMPLETE');
    const revenue = (revenueData || []).reduce((sum: number, r: { amount: number | null }) => sum + (r.amount || 0), 0);

    setMetrics({ actions, threats, trust, agents: agentsRes.count || 0, revenue });
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [productsRes, agentsRes, actionsRes, alertsRes, paymentsRes] = await Promise.all([
        supabase.from('merchant_products').select('*').order('product_id'),
        supabase.from('agents').select('*').order('agent_id'),
        supabase.from('agent_actions').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('collusion_alerts').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      if (productsRes.error) throw productsRes.error;
      setProducts(productsRes.data as MerchantProduct[]);
      setAgents(agentsRes.data as Agent[]);
      setAlerts(alertsRes.data as CollusionAlert[]);
      setPayments(paymentsRes.data as Payment[]);

      const events: ActivityEvent[] = (actionsRes.data as AgentAction[]).map((a) => ({
        id: a.id,
        pillar: a.action_type.includes('CLAIM') ? 'Truth Checker' : a.action_type.includes('FAIRNESS') ? 'Fairness Oracle' : a.action_type.includes('DISPUTE') ? 'Dispute Arbitrator' : a.action_type.includes('COLLUSION') ? 'Collision Detector' : a.action_type.includes('COMMERCE') ? 'Commerce Agent' : 'Consent Oracle',
        action: a.action_type.replace(/_/g, ' '),
        verdict: a.verification_status,
        timestamp: a.created_at,
      }));
      setActivity(events);

      setDbConnected(true);
      refreshMetrics();
    } catch (err) {
      setDbConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to connect to database');
    }
  }, [refreshMetrics]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const runPillar = async (key: PillarKey) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    setError(null);
    try {
      let result: Result;
      let actionLabel = '';

      if (key === 'truth') {
        actionLabel = `Verify ${truthForm.claimType} claim for ${truthForm.productId}`;
        result = await verifyClaim(truthForm.productId, truthForm.claimType, parseFloat(truthForm.claimedValue));
      } else if (key === 'fairness') {
        actionLabel = 'Analyze conversation for dark patterns';
        result = await analyzeFairness(fairnessForm.conversation);
      } else if (key === 'dispute') {
        actionLabel = `File dispute: ${disputeForm.buyer} vs ${disputeForm.seller}`;
        result = await fileDispute(disputeForm.buyer, disputeForm.seller, parseFloat(disputeForm.amount), disputeForm.terms, disputeForm.evidence);
      } else if (key === 'collision') {
        actionLabel = `Analyze prices for ${collisionForm.productId}`;
        result = await analyzePrices(
          collisionForm.productId,
          parseFloat(collisionForm.marketPrice),
          collisionForm.agentPrices.map((a) => ({ agentId: a.agentId, price: parseFloat(a.price) }))
        );
      } else if (key === 'consent') {
        actionLabel = 'Simplify terms and log consent';
        result = await simplifyAndLog(consentForm.userId, consentForm.terms, consentForm.acknowledged);
      } else {
        actionLabel = 'PURCHASE_COMPLETE';
        setCommerceLog([]);
        result = await executePurchase(commerceForm.productId, parseFloat(commerceForm.budget));
        const cr = result as CommerceResult;
        for (const step of cr.negotiation_steps) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          setCommerceLog((prev) => [...prev, step]);
        }
      }

      const verdict = (result as unknown as Record<string, unknown>).verdict as string;
      addActivity(PILLARS.find((p) => p.key === key)!.title, actionLabel, verdict);
      setActiveResult({ key, result });
      refreshMetrics();
      loadInitialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleCreateOrder = async () => {
    setLoading((prev) => ({ ...prev, payment: true }));
    setPaymentStatus(null);
    try {
      const order = await createOrder(parseFloat(paymentForm.amount));
      setPaymentStatus(`Order created: ${order.order_id} — ₹${order.amount}`);
      addActivity('Razorpay', `Create order ₹${paymentForm.amount}`, 'CREATED');
      const capture = await capturePayment(order.order_id);
      setPaymentStatus(`Order: ${order.order_id} | Payment: ${capture.payment_id} | Status: ${capture.status} | Amount: ₹${order.amount}`);
      addActivity('Razorpay', `Capture payment ${capture.payment_id}`, 'CAPTURED');
      const pays = await getPayments();
      setPayments(pays);
    } catch (err) {
      setPaymentStatus(`Error: ${err instanceof Error ? err.message : 'Payment failed'}`);
    } finally {
      setLoading((prev) => ({ ...prev, payment: false }));
    }
  };

  const handleRefund = async (paymentId: string) => {
    try {
      await refundPayment(paymentId);
      addActivity('Razorpay', `Refund ${paymentId}`, 'REFUNDED');
      const pays = await getPayments();
      setPayments(pays);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    }
  };

  const startNegotiation = async () => {
    setLoading((prev) => ({ ...prev, negotiation: true }));
    setNegotiationLog([]);
    const steps = [
      'Agent-A1 (Buyer): Requesting price for P003 (Bluetooth Speaker Mini)',
      'Agent-A2 (Seller): Offering at ₹500 (market price ₹450)',
      'Agent-A1 (Buyer): Price seems above market. Running Truth Check...',
      'AEGIS Truth Checker: Verified — catalog price is ₹1,499, discount 5%. No hallucination on price.',
      'Agent-A1 (Buyer): Running Fairness Oracle on seller conversation...',
      'AEGIS Fairness Oracle: WARNING — Urgency 60, Pressure 40, Confusion 20. Total: 120. Below threshold.',
      'Agent-A3 (Supplier): Also offering at ₹500. Agent-A4 (Auditor) detecting pattern...',
      'AEGIS Collision Detector: 3 agents pricing above market ₹450. COLLUSION_DETECTED. Severity: MEDIUM.',
      'Agent-A5 (Arbitrator): Filing dispute on behalf of buyer. Awarding 10% compensation.',
      'AEGIS Dispute Arbitrator: COMPENSATION_AWARDED — ₹50 awarded to buyer agent A1.',
      'Agent-A1 (Buyer): Consent logged for transaction terms. SHA256 hash recorded.',
      'Negotiation complete. All AEGIS pillars engaged successfully.',
    ];
    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setNegotiationLog((prev) => [...prev, step]);
    }
    refreshMetrics();
    loadInitialData();
    setLoading((prev) => ({ ...prev, negotiation: false }));
  };

  const navItems = [
    { key: 'dashboard' as View, label: 'Dashboard', icon: Activity },
    { key: 'pillars' as View, label: 'Pillars', icon: Shield },
    { key: 'agents' as View, label: 'Agents', icon: Bot },
    { key: 'settings' as View, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon"><Lock size={20} /></div>
            <div className="logo-text">
              <span className="logo-title">AEGIS</span>
              <span className="logo-subtitle">Guardian Protocol</span>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => { setView(item.key); setSidebarOpen(false); }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="db-status">
            <Database size={14} />
            <span>{dbConnected ? 'Database Connected' : 'Connecting...'}</span>
          </div>
          <div className="version-tag">v2.0 · Razorpay Buildathon</div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="header-title">
            <h1>{view === 'dashboard' ? 'Command Center' : view === 'pillars' ? 'Protection Pillars' : view === 'agents' ? 'Agent Simulation' : 'Settings'}</h1>
            <span className="header-subtitle">Real-time Agentic Commerce Guardian</span>
          </div>
          <div className="header-status">
            <button
              className={`toggle-switch ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-pressed={theme === 'light'}
            >
              <Moon size={15} aria-hidden="true" />
              <span className={`toggle-label ${theme === 'dark' ? 'active' : ''}`}>Dark</span>
              <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
              <span className={`toggle-label ${theme === 'light' ? 'active' : ''}`}>Light</span>
              <Sun size={15} aria-hidden="true" />
            </button>
            <div className={`status-indicator ${dbConnected ? 'online' : 'connecting'}`}>
              <span className="status-dot" />
              <span>{dbConnected ? 'All Systems Nominal' : 'Connecting...'}</span>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        <div className="content-body">
          {view === 'dashboard' && (
            <>
              {/* Metrics */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon purple"><TrendingUp size={20} /></div>
                  <div className="metric-data">
                    <span className="metric-value">{metrics.actions}</span>
                    <span className="metric-label">Actions Screened</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon red"><AlertTriangle size={20} /></div>
                  <div className="metric-data">
                    <span className="metric-value">{metrics.threats}</span>
                    <span className="metric-label">Threats Blocked</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon green"><CheckCircle2 size={20} /></div>
                  <div className="metric-data">
                    <span className="metric-value">{metrics.trust}%</span>
                    <span className="metric-label">Trust Coverage</span>
                  </div>
                </div>
                <div className="metric-card revenue-card">
                  <div className="metric-icon cyan"><IndianRupee size={20} /></div>
                  <div className="metric-data">
                    <span className="metric-value">₹{metrics.revenue.toLocaleString('en-IN')}</span>
                    <span className="metric-label">Revenue Generated</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon blue"><Bot size={20} /></div>
                  <div className="metric-data">
                    <span className="metric-value">{metrics.agents}</span>
                    <span className="metric-label">Active Agents</span>
                  </div>
                </div>
              </div>

              {/* Agent Simulation + Payment Panel */}
              <div className="dashboard-panels">
                <div className="panel-card agent-panel">
                  <div className="panel-header">
                    <Bot size={18} />
                    <h3>Agent Simulation</h3>
                  </div>
                  <div className="agent-list">
                    {agents.map((agent) => (
                      <div key={agent.agent_id} className="agent-item">
                        <div className="agent-avatar">{agent.agent_id}</div>
                        <div className="agent-info">
                          <span className="agent-name">{agent.name}</span>
                          <span className="agent-role">{agent.role}</span>
                        </div>
                        <span className={`agent-status-badge ${agent.status.toLowerCase()}`}>{agent.status}</span>
                      </div>
                    ))}
                  </div>
                  <button className="action-btn" onClick={startNegotiation} disabled={loading.negotiation}>
                    {loading.negotiation ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                    <span>{loading.negotiation ? 'Negotiating...' : 'Start Negotiation'}</span>
                  </button>
                  {negotiationLog.length > 0 && (
                    <div className="negotiation-log">
                      {negotiationLog.map((line, i) => (
                        <div key={i} className="negotiation-line" style={{ animationDelay: `${i * 50}ms` }}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel-card payment-panel">
                  <div className="panel-header">
                    <CreditCard size={18} />
                    <h3>Razorpay Test Mode</h3>
                  </div>
                  <div className="payment-form">
                    <input
                      type="number"
                      placeholder="Amount (in ₹)"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    />
                    <button className="action-btn" onClick={handleCreateOrder} disabled={loading.payment}>
                      {loading.payment ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                      <span>Create Test Order</span>
                    </button>
                  </div>
                  {paymentStatus && <div className="payment-status">{paymentStatus}</div>}
                  {payments.length > 0 && (
                    <div className="payment-list">
                      <div className="payment-list-header">Recent Transactions:</div>
                      {payments.map((pay) => (
                        <div key={pay.id} className="payment-item">
                          <div className="payment-info">
                            <span className="payment-order">{pay.order_id || 'N/A'}</span>
                            <span className={`payment-status-badge ${pay.status.toLowerCase()}`}>{pay.status}</span>
                          </div>
                          <div className="payment-amount">₹{pay.amount}</div>
                          {pay.status === 'CAPTURED' && (
                            <button className="refund-btn" onClick={() => handleRefund(pay.payment_id!)}>Refund</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Alerts */}
              {alerts.length > 0 && (
                <div className="alerts-section">
                  <div className="section-title">
                    <AlertTriangle size={18} />
                    <h3>Active Collusion Alerts</h3>
                  </div>
                  <div className="alerts-list">
                    {alerts.map((alert) => (
                      <div key={alert.id} className={`alert-item severity-${alert.severity.toLowerCase()}`}>
                        <div className="alert-header">
                          <span className="alert-type">{alert.alert_type.replace(/_/g, ' ')}</span>
                          <span className={`alert-severity ${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                        </div>
                        <div className="alert-desc">{alert.description}</div>
                        {alert.agents_involved.length > 0 && (
                          <div className="alert-agents">
                            {alert.agents_involved.map((a, i) => <span key={i} className="agent-tag-sm">{a}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {view === 'pillars' && (
            <>
              {/* Pillar Cards Grid */}
              <div className="pillar-grid">
                {PILLARS.map((pillar, idx) => (
                  <div key={pillar.key} className="pillar-card">
                    <div className={`pillar-card-top pillar-${pillar.color}`} />
                    <div className="pillar-card-body">
                      <div className="pillar-card-header">
                        <div className={`pillar-icon pillar-${pillar.color}`}>
                          <pillar.icon size={22} />
                        </div>
                        <span className="pillar-number">PILLAR {idx + 1}</span>
                      </div>
                      <h3 className="pillar-title">{pillar.title}</h3>
                      <span className={`pillar-tag pillar-${pillar.color}`}>{pillar.subtitle}</span>
                      <p className="pillar-desc">{pillar.desc}</p>

                      {/* Input Forms */}
                      {pillar.key === 'truth' && (
                        <div className="pillar-input">
                          <select value={truthForm.claimType} onChange={(e) => setTruthForm({ ...truthForm, claimType: e.target.value as 'discount' | 'price' | 'stock' })}>
                            <option value="discount">Discount %</option>
                            <option value="price">Price ₹</option>
                            <option value="stock">Stock Units</option>
                          </select>
                          <input type="text" placeholder="Product ID (e.g., P001)" value={truthForm.productId} onChange={(e) => setTruthForm({ ...truthForm, productId: e.target.value })} />
                          <input type="number" placeholder="Claimed Value" value={truthForm.claimedValue} onChange={(e) => setTruthForm({ ...truthForm, claimedValue: e.target.value })} />
                        </div>
                      )}
                      {pillar.key === 'fairness' && (
                        <div className="pillar-input">
                          <textarea placeholder="Paste agent conversation text..." value={fairnessForm.conversation} onChange={(e) => setFairnessForm({ ...fairnessForm, conversation: e.target.value })} rows={4} />
                        </div>
                      )}
                      {pillar.key === 'dispute' && (
                        <div className="pillar-input">
                          <div className="input-row">
                            <input type="text" placeholder="Buyer Agent" value={disputeForm.buyer} onChange={(e) => setDisputeForm({ ...disputeForm, buyer: e.target.value })} />
                            <input type="text" placeholder="Seller Agent" value={disputeForm.seller} onChange={(e) => setDisputeForm({ ...disputeForm, seller: e.target.value })} />
                          </div>
                          <input type="number" placeholder="Transaction Amount ₹" value={disputeForm.amount} onChange={(e) => setDisputeForm({ ...disputeForm, amount: e.target.value })} />
                          <input type="text" placeholder="Contract Terms" value={disputeForm.terms} onChange={(e) => setDisputeForm({ ...disputeForm, terms: e.target.value })} />
                          <input type="text" placeholder="Delivery Evidence" value={disputeForm.evidence} onChange={(e) => setDisputeForm({ ...disputeForm, evidence: e.target.value })} />
                        </div>
                      )}
                      {pillar.key === 'collision' && (
                        <div className="pillar-input">
                          <div className="input-row">
                            <input type="text" placeholder="Product ID" value={collisionForm.productId} onChange={(e) => setCollisionForm({ ...collisionForm, productId: e.target.value })} />
                            <input type="number" placeholder="Market Price ₹" value={collisionForm.marketPrice} onChange={(e) => setCollisionForm({ ...collisionForm, marketPrice: e.target.value })} />
                          </div>
                          {collisionForm.agentPrices.map((ap, i) => (
                            <div key={i} className="input-row">
                              <input type="text" placeholder="Agent ID" value={ap.agentId} onChange={(e) => {
                                const updated = [...collisionForm.agentPrices];
                                updated[i] = { ...ap, agentId: e.target.value };
                                setCollisionForm({ ...collisionForm, agentPrices: updated });
                              }} />
                              <input type="number" placeholder="Agent Price ₹" value={ap.price} onChange={(e) => {
                                const updated = [...collisionForm.agentPrices];
                                updated[i] = { ...ap, price: e.target.value };
                                setCollisionForm({ ...collisionForm, agentPrices: updated });
                              }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {pillar.key === 'consent' && (
                        <div className="pillar-input">
                          <input type="text" placeholder="User ID" value={consentForm.userId} onChange={(e) => setConsentForm({ ...consentForm, userId: e.target.value })} />
                          <textarea placeholder="Original Terms (legal text)" value={consentForm.terms} onChange={(e) => setConsentForm({ ...consentForm, terms: e.target.value })} rows={4} />
                          <label className="checkbox-label">
                            <input type="checkbox" checked={consentForm.acknowledged} onChange={(e) => setConsentForm({ ...consentForm, acknowledged: e.target.checked })} />
                            <span>User acknowledges simplified terms</span>
                          </label>
                        </div>
                      )}
                      {pillar.key === 'commerce' && (
                        <div className="pillar-input">
                          <select value={commerceForm.productId} onChange={(e) => setCommerceForm({ ...commerceForm, productId: e.target.value })}>
                            {products.filter((p) => ['P001', 'P002', 'P003'].includes(p.product_id)).map((p) => (
                              <option key={p.product_id} value={p.product_id}>{p.product_id} — {p.name} (₹{p.price})</option>
                            ))}
                          </select>
                          <input type="number" placeholder="Budget (₹)" value={commerceForm.budget} onChange={(e) => setCommerceForm({ ...commerceForm, budget: e.target.value })} />
                        </div>
                      )}

                      <button className="run-btn" onClick={() => runPillar(pillar.key)} disabled={loading[pillar.key]}>
                        {loading[pillar.key] ? <Loader2 size={16} className="spin" /> : pillar.key === 'commerce' ? <ShoppingBag size={16} /> : <Play size={16} />}
                        <span>{loading[pillar.key] ? (pillar.key === 'commerce' ? 'Purchasing...' : 'Processing...') : (pillar.key === 'commerce' ? 'Execute Purchase' : 'Run Analysis')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commerce Live Log */}
              {commerceLog.length > 0 && activeResult?.key === 'commerce' && (
                <div className="result-panel">
                  <div className="result-panel-header">
                    <h3>Live Negotiation & Checkout</h3>
                  </div>
                  <div className="negotiation-log">
                    {commerceLog.map((line, i) => (
                      <div key={i} className="negotiation-line" style={{ animationDelay: `${i * 50}ms` }}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Panel */}
              {activeResult && (
                <div className="result-panel">
                  <div className="result-panel-header">
                    <h3>Decision Trace — {PILLARS.find((p) => p.key === activeResult.key)?.title}</h3>
                  </div>
                  <ResultRenderer pillarKey={activeResult.key} result={activeResult.result} />
                </div>
              )}
            </>
          )}

          {view === 'agents' && (
            <div className="agents-view">
              <div className="agents-grid">
                {agents.map((agent) => (
                  <div key={agent.agent_id} className="agent-card">
                    <div className="agent-card-header">
                      <div className="agent-card-avatar">{agent.agent_id}</div>
                      <div>
                        <h3 className="agent-card-name">{agent.name}</h3>
                        <span className={`agent-card-role agent-role-${agent.role.toLowerCase()}`}>{agent.role}</span>
                      </div>
                    </div>
                    <p className="agent-card-behavior">{agent.behavior}</p>
                    <div className="agent-card-status">
                      <span className={`status-dot ${agent.status.toLowerCase()}`} />
                      <span>{agent.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel-card agent-panel">
                <div className="panel-header">
                  <Bot size={18} />
                  <h3>Live Negotiation</h3>
                </div>
                <button className="action-btn" onClick={startNegotiation} disabled={loading.negotiation}>
                  {loading.negotiation ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                  <span>{loading.negotiation ? 'Negotiating...' : 'Start Negotiation'}</span>
                </button>
                {negotiationLog.length > 0 && (
                  <div className="negotiation-log">
                    {negotiationLog.map((line, i) => (
                      <div key={i} className="negotiation-line" style={{ animationDelay: `${i * 50}ms` }}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="settings-view">
              <div className="panel-card">
                <div className="panel-header"><Settings size={18} /><h3>System Configuration</h3></div>
                <div className="settings-list">
                  <div className="setting-item"><span>Database</span><span className="setting-value">{dbConnected ? 'Connected (Supabase)' : 'Disconnected'}</span></div>
                  <div className="setting-item"><span>Payment Gateway</span><span className="setting-value">Razorpay Test Mode</span></div>
                  <div className="setting-item"><span>Fairness Threshold</span><span className="setting-value">200 (auto-escalate)</span></div>
                  <div className="setting-item"><span>Collusion Threshold</span><span className="setting-value">3+ agents above market</span></div>
                  <div className="setting-item"><span>Compensation Rate</span><span className="setting-value">10% of transaction</span></div>
                  <div className="setting-item"><span>Consent Hash</span><span className="setting-value">SHA-256</span></div>
                </div>
              </div>
              <div className="panel-card">
                <div className="panel-header"><BookOpen size={18} /><h3>How AEGIS Works</h3></div>
                <div className="docs-list">
                  <div className="doc-item"><Shield size={16} className="doc-icon purple" /><div><strong>Truth Checker</strong> — Verifies agent claims against the merchant product catalog. Flags hallucinations when claimed values don't match actual data.</div></div>
                  <div className="doc-item"><Scale size={16} className="doc-icon amber" /><div><strong>Fairness Oracle</strong> — Scores conversations for urgency, pressure, and confusion. Auto-escalates when total score exceeds 200.</div></div>
                  <div className="doc-item"><Gavel size={16} className="doc-icon green" /><div><strong>Dispute Arbitrator</strong> — Files and arbitrates disputes. Awards 10% compensation on contract breach.</div></div>
                  <div className="doc-item"><Network size={16} className="doc-icon red" /><div><strong>Collision Detector</strong> — Detects price fixing when 3+ agents price above market rate.</div></div>
                  <div className="doc-item"><FileCheck size={16} className="doc-icon blue" /><div><strong>Consent Oracle</strong> — Simplifies legal terms and logs user acknowledgment with SHA-256 hash.</div></div>
                  <div className="doc-item"><ShoppingBag size={16} className="doc-icon cyan" /><div><strong>Commerce Agent</strong> — AI buyer searches catalog, negotiates price, completes checkout via Razorpay, and generates revenue for merchants.</div></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Log Sidebar */}
        <aside className="activity-sidebar">
          <div className="activity-header">
            <Activity size={18} />
            <h3>Activity Stream</h3>
            <span className="activity-count">{activity.length}</span>
          </div>
          <div className="activity-list">
            {activity.length === 0 ? (
              <div className="activity-empty">No activity yet. Run a pillar to see results.</div>
            ) : (
              activity.map((event) => {
                const colorClass = event.verdict.includes('HALLUCINATION') || event.verdict.includes('COLLUSION') || event.verdict.includes('ALERT')
                  ? 'danger'
                  : event.verdict.includes('ESCALATED') || event.verdict.includes('PENDING') || event.verdict.includes('DISMISSED')
                  ? 'warning'
                  : 'success';
                return (
                  <div key={event.id} className={`activity-item activity-${colorClass}`}>
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-pillar">{event.pillar}</div>
                      <div className="activity-action">{event.action}</div>
                      <div className="activity-verdict">{event.verdict.replace(/_/g, ' ')}</div>
                      <div className="activity-time">{new Date(event.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
