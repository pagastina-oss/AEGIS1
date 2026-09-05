import { supabase } from '../supabase';
import type { DisputeResult } from '../types';

export async function fileDispute(
  buyerAgentId: string,
  sellerAgentId: string,
  transactionAmount: number,
  contractTerms: string,
  deliveryEvidence: string
): Promise<DisputeResult> {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({
      buyer_agent_id: buyerAgentId,
      seller_agent_id: sellerAgentId,
      transaction_amount: transactionAmount,
      contract_terms: contractTerms,
      delivery_evidence: deliveryEvidence,
      status: 'FILED',
      award_amount: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return await arbitrateDispute(dispute.id);
}

export async function arbitrateDispute(disputeId: string): Promise<DisputeResult> {
  const { data: dispute, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .maybeSingle();

  if (error) throw error;
  if (!dispute) throw new Error('Dispute not found');

  const evidence = (dispute.delivery_evidence || '').toLowerCase();
  void (dispute.contract_terms || '').toLowerCase();

  let breachFound = false;
  let rationale = '';

  if (evidence.includes('delay') || evidence.includes('late') || evidence.includes('48 hour') || evidence.includes('96 hour')) {
    breachFound = true;
    rationale = `Contract breach detected: ${dispute.delivery_evidence}. Delivery terms stated "${dispute.contract_terms}".`;
  } else if (evidence.includes('damaged') || evidence.includes('defective') || evidence.includes('wrong')) {
    breachFound = true;
    rationale = `Product quality breach: ${dispute.delivery_evidence}.`;
  } else if (evidence.includes('no delivery') || evidence.includes('not received') || evidence.includes('missing')) {
    breachFound = true;
    rationale = `Non-delivery breach: ${dispute.delivery_evidence}.`;
  } else {
    rationale = `No contract breach detected. Evidence reviewed: ${dispute.delivery_evidence}.`;
  }

  const awardAmount = breachFound ? dispute.transaction_amount * 0.1 : 0;
  const status = breachFound ? 'RESOLVED' : 'DISMISSED';
  const verdict = breachFound ? 'COMPENSATION_AWARDED' : 'DISPUTE_DISMISSED';

  await supabase
    .from('disputes')
    .update({ status, award_amount: awardAmount, rationale })
    .eq('id', disputeId);

  await supabase.from('agent_actions').insert({
    agent_id: 'A5',
    user_id: 'U001',
    action_type: 'DISPUTE_ARBITRATION',
    amount: awardAmount,
    verification_status: status,
  });

  if (breachFound && awardAmount > 0) {
    await supabase.from('payments').insert({
      order_id: `comp_${disputeId.slice(0, 8)}`,
      payment_id: `pay_${Date.now()}`,
      amount: awardAmount,
      currency: 'INR',
      status: 'CAPTURED',
      dispute_id: disputeId,
    });
  }

  return {
    dispute_id: disputeId,
    status,
    award_amount: awardAmount,
    rationale,
    verdict,
  };
}
