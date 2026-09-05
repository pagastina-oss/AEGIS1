import { Copy, Check, Fingerprint, Shield, Scale, Gavel, Network, FileCheck, AlertTriangle, CheckCircle2, XCircle, ShoppingBag, IndianRupee } from 'lucide-react';
import { useState } from 'react';
import type { TruthCheckResult, FairnessResult, DisputeResult, CollusionResult, ConsentResult, CommerceResult } from '../lib/types';

type Result = TruthCheckResult | FairnessResult | DisputeResult | CollusionResult | ConsentResult | CommerceResult | null;

function verdictColor(verdict: string): string {
  if (verdict.includes('HALLUCINATION') || verdict.includes('COLLUSION') || verdict.includes('CRITICAL') || verdict.includes('FAILED')) return 'danger';
  if (verdict.includes('WARNING') || verdict.includes('PENDING') || verdict.includes('DISMISSED')) return 'warning';
  if (verdict.includes('VERIFIED') || verdict.includes('AWARDED') || verdict.includes('LOGGED') || verdict.includes('FAIR') || verdict.includes('NO_COLLUSION') || verdict.includes('PURCHASE_COMPLETE')) return 'success';
  return 'neutral';
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const color = verdictColor(verdict);
  const icon = color === 'danger' ? <XCircle size={16} /> : color === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />;
  return (
    <div className={`verdict-badge verdict-${color}`}>
      {icon}
      <span>{verdict}</span>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="score-bar-wrapper">
      <div className="score-bar-header">
        <span className="score-bar-label">{label}</span>
        <span className="score-bar-value">{score}/100</span>
      </div>
      <div className="score-bar-track">
        <div className={`score-bar-fill score-bar-${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function HashDisplay({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="hash-display" onClick={copy}>
      <span className="hash-text">{hash.slice(0, 32)}...{hash.slice(-16)}</span>
      {copied ? <Check size={16} className="hash-copied" /> : <Copy size={16} />}
    </div>
  );
}

export default function ResultRenderer({ pillarKey, result }: { pillarKey: string; result: Result }) {
  if (!result) return null;

  const r = result as unknown as Record<string, unknown>;

  return (
    <div className="result-renderer">
      <VerdictBadge verdict={r.verdict as string} />

      {pillarKey === 'truth' && (
        <div className="result-body">
          <div className="result-row">
            <Shield size={18} className="result-icon" />
            <div className="result-detail">
              <div className="result-label">Product</div>
              <div className="result-value">{(result as TruthCheckResult).product?.name || 'Not found'}</div>
            </div>
          </div>
          <div className="result-grid-2">
            <div className="result-stat">
              <span className="stat-label">Claimed Value</span>
              <span className="stat-value">{(result as TruthCheckResult).claimed_value}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Actual Value</span>
              <span className="stat-value">{(result as TruthCheckResult).actual_value}</span>
            </div>
          </div>
          <div className="discrepancy-meter">
            <div className="discrepancy-header">
              <span>Discrepancy</span>
              <span>{(result as TruthCheckResult).discrepancy}%</span>
            </div>
            <div className="discrepancy-track">
              <div className="discrepancy-fill" style={{ width: `${Math.min(100, (result as TruthCheckResult).discrepancy)}%` }} />
            </div>
          </div>
          <div className="result-rationale">{(result as TruthCheckResult).rationale}</div>
        </div>
      )}

      {pillarKey === 'fairness' && (
        <div className="result-body">
          <div className="result-icon-row"><Scale size={20} /></div>
          <ScoreBar label="Urgency Score" score={(result as FairnessResult).urgency_score} color="amber" />
          <ScoreBar label="Pressure Score" score={(result as FairnessResult).pressure_score} color="red" />
          <ScoreBar label="Confusion Score" score={(result as FairnessResult).confusion_score} color="purple" />
          <div className="threshold-line">
            <div className="threshold-marker" style={{ left: '66%' }} />
            <div className="threshold-label">Threshold: 200</div>
          </div>
          <div className="total-score">
            <span className="total-label">Total Score</span>
            <span className={`total-value ${verdictColor((result as FairnessResult).verdict)}`}>{(result as FairnessResult).total_score}</span>
          </div>
          {(result as FairnessResult).keyword_matches.length > 0 && (
            <div className="keyword-tags">
              <div className="keyword-tags-label">Detected Keywords:</div>
              <div className="keyword-tag-list">
                {(result as FairnessResult).keyword_matches.map((kw, i) => (
                  <span key={i} className="keyword-tag">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {(result as FairnessResult).auto_escalate && (
            <div className="escalate-warning">
              <AlertTriangle size={16} />
              <span>AUTO-ESCALATION TRIGGERED — Total score exceeds 200</span>
            </div>
          )}
        </div>
      )}

      {pillarKey === 'dispute' && (
        <div className="result-body">
          <div className="result-icon-row"><Gavel size={20} /></div>
          <div className="result-grid-2">
            <div className="result-stat">
              <span className="stat-label">Transaction Amount</span>
              <span className="stat-value">₹{(result as DisputeResult).award_amount * 10}</span>
            </div>
            <div className="result-stat highlight">
              <span className="stat-label">Compensation Awarded</span>
              <span className="stat-value success">₹{(result as DisputeResult).award_amount}</span>
            </div>
          </div>
          <div className="result-rationale">{(result as DisputeResult).rationale}</div>
          <div className="dispute-status">
            <span className="dispute-status-label">Status:</span>
            <span className={`dispute-status-value verdict-${verdictColor((result as DisputeResult).verdict)}`}>{(result as DisputeResult).status}</span>
          </div>
        </div>
      )}

      {pillarKey === 'collision' && (
        <div className="result-body">
          <div className="result-icon-row"><Network size={20} /></div>
          <div className="result-grid-2">
            <div className="result-stat">
              <span className="stat-label">Market Price</span>
              <span className="stat-value">₹{(result as CollusionResult).market_price}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Detected Avg Price</span>
              <span className="stat-value">₹{(result as CollusionResult).detected_price.toFixed(0)}</span>
            </div>
          </div>
          {(result as CollusionResult).agents_involved.length > 0 && (
            <div className="colluding-agents">
              <div className="colluding-label">Agents Involved:</div>
              <div className="agent-tag-list">
                {(result as CollusionResult).agents_involved.map((agent, i) => (
                  <span key={i} className="agent-tag">{agent}</span>
                ))}
              </div>
            </div>
          )}
          {(result as CollusionResult).is_collusion && (
            <div className={`severity-badge severity-${(result as CollusionResult).severity.toLowerCase()}`}>
              <AlertTriangle size={16} />
              <span>SEVERITY: {(result as CollusionResult).severity}</span>
            </div>
          )}
          <div className="result-rationale">{(result as CollusionResult).description}</div>
        </div>
      )}

      {pillarKey === 'consent' && (
        <div className="result-body">
          <div className="result-icon-row"><FileCheck size={20} /></div>
          <div className="consent-section">
            <div className="consent-label">Simplified Terms:</div>
            <div className="consent-terms">{(result as ConsentResult).simplified_terms}</div>
          </div>
          <div className="consent-section">
            <div className="consent-label">SHA-256 Hash (Proof of Understanding):</div>
            <HashDisplay hash={(result as ConsentResult).hash} />
          </div>
          <div className="consent-ack">
            <Fingerprint size={18} />
            <span>{(result as ConsentResult).user_acknowledged ? 'User acknowledged the simplified terms' : 'Acknowledgment pending'}</span>
          </div>
        </div>
      )}

      {pillarKey === 'commerce' && (
        <div className="result-body">
          <div className="result-icon-row"><ShoppingBag size={20} /></div>
          {(result as CommerceResult).product && (
            <div className="result-row">
              <ShoppingBag size={18} className="result-icon" />
              <div className="result-detail">
                <div className="result-label">Product Purchased</div>
                <div className="result-value">{(result as CommerceResult).product!.name}</div>
              </div>
            </div>
          )}
          <div className="result-grid-2">
            <div className="result-stat">
              <span className="stat-label">List Price</span>
              <span className="stat-value">₹{(result as CommerceResult).list_price.toLocaleString('en-IN')}</span>
            </div>
            <div className="result-stat highlight">
              <span className="stat-label">Negotiated Price</span>
              <span className="stat-value success">₹{(result as CommerceResult).negotiated_price.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="result-grid-2">
            <div className="result-stat">
              <span className="stat-label">Discount Applied</span>
              <span className="stat-value">{(result as CommerceResult).discount_applied}%</span>
            </div>
            <div className="result-stat highlight">
              <span className="stat-label">Revenue Generated</span>
              <span className="stat-value success">₹{(result as CommerceResult).revenue.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {(result as CommerceResult).order_id && (
            <div className="commerce-payment-info">
              <div className="commerce-pay-row">
                <span className="commerce-pay-label">Order ID:</span>
                <span className="commerce-pay-value">{(result as CommerceResult).order_id}</span>
              </div>
              <div className="commerce-pay-row">
                <span className="commerce-pay-label">Payment ID:</span>
                <span className="commerce-pay-value">{(result as CommerceResult).payment_id}</span>
              </div>
              <div className="commerce-pay-row">
                <span className="commerce-pay-label">Payment Status:</span>
                <span className={`commerce-pay-status ${(result as CommerceResult).payment_status.toLowerCase()}`}>{(result as CommerceResult).payment_status}</span>
              </div>
            </div>
          )}
          <div className="revenue-highlight">
            <IndianRupee size={18} />
            <span>Revenue generated for merchant: ₹{(result as CommerceResult).revenue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
