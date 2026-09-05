import { supabase } from '../supabase';
import type { CollusionResult } from '../types';

export async function analyzePrices(
  productId: string,
  marketPrice: number,
  agentPrices: { agentId: string; price: number }[]
): Promise<CollusionResult> {
  const aboveMarket = agentPrices.filter((a) => a.price > marketPrice);
  const isCollusion = aboveMarket.length >= 3;
  const agentsInvolved = aboveMarket.map((a) => a.agentId);
  const detectedPrice = aboveMarket.length > 0
    ? aboveMarket.reduce((sum, a) => sum + a.price, 0) / aboveMarket.length
    : 0;

  let severity = 'LOW';
  if (isCollusion) {
    const markupPct = ((detectedPrice - marketPrice) / marketPrice) * 100;
    if (markupPct > 20) severity = 'CRITICAL';
    else if (markupPct > 10) severity = 'HIGH';
    else severity = 'MEDIUM';
  }

  const description = isCollusion
    ? `${aboveMarket.length} agents pricing above market rate by ₹${(detectedPrice - marketPrice).toFixed(0)} (${(((detectedPrice - marketPrice) / marketPrice) * 100).toFixed(1)}% markup). Collusion pattern detected.`
    : `${aboveMarket.length} agents above market price. No collusion threshold reached (need 3+).`;

  const verdict = isCollusion ? 'COLLUSION_DETECTED' : 'NO_COLLUSION';

  if (isCollusion) {
    await supabase.from('collusion_alerts').insert({
      alert_type: 'PRICE_FIXING',
      severity,
      description,
      agents_involved: agentsInvolved,
      market_price: marketPrice,
      detected_price: detectedPrice,
      product_id: productId,
    });

    await supabase.from('agent_actions').insert({
      agent_id: 'A4',
      user_id: 'U001',
      action_type: 'COLLUSION_CHECK',
      verification_status: 'ALERT_RAISED',
    });
  }

  return {
    is_collusion: isCollusion,
    severity,
    agents_involved: agentsInvolved,
    market_price: marketPrice,
    detected_price: detectedPrice,
    description,
    verdict,
  };
}
