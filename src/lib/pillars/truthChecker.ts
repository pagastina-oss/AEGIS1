import { supabase } from '../supabase';
import type { TruthCheckResult, MerchantProduct } from '../types';

export async function verifyClaim(
  productId: string,
  claimType: 'discount' | 'price' | 'stock',
  claimedValue: number
): Promise<TruthCheckResult> {
  const { data: product, error } = await supabase
    .from('merchant_products')
    .select('*')
    .eq('product_id', productId.toUpperCase())
    .maybeSingle();

  if (error) throw error;

  if (!product) {
    return {
      is_verified: false,
      actual_value: 0,
      claimed_value: claimedValue,
      discrepancy: 100,
      rationale: `Product ${productId} not found in merchant catalog.`,
      verdict: 'HALLUCINATION_DETECTED',
      product: null,
    };
  }

  let actualValue = 0;
  let discrepancy = 0;
  let isVerified = false;
  let rationale = '';

  if (claimType === 'discount') {
    actualValue = product.discount;
    discrepancy = Math.abs(claimedValue - actualValue);
    isVerified = claimedValue === actualValue;
    rationale = isVerified
      ? `Claimed discount ${claimedValue}% matches catalog discount ${actualValue}%.`
      : `Claimed discount ${claimedValue}% does NOT match actual discount ${actualValue}%. Discrepancy: ${discrepancy}%.`;
  } else if (claimType === 'price') {
    actualValue = product.price;
    discrepancy = Math.abs(claimedValue - actualValue);
    const pctDiff = (discrepancy / actualValue) * 100;
    isVerified = pctDiff < 1;
    rationale = isVerified
      ? `Claimed price ₹${claimedValue} matches catalog price ₹${actualValue}.`
      : `Claimed price ₹${claimedValue} does NOT match actual price ₹${actualValue}. Discrepancy: ${pctDiff.toFixed(1)}%.`;
  } else if (claimType === 'stock') {
    actualValue = product.stock;
    discrepancy = Math.abs(claimedValue - actualValue);
    isVerified = claimedValue === actualValue;
    rationale = isVerified
      ? `Claimed stock ${claimedValue} units matches catalog stock ${actualValue} units.`
      : `Claimed stock ${claimedValue} units does NOT match actual stock ${actualValue} units.`;
  }

  const verdict = isVerified ? 'VERIFIED' : 'HALLUCINATION_DETECTED';

  await supabase.from('agent_actions').insert({
    agent_id: 'A2',
    user_id: 'U001',
    action_type: `CLAIM_${claimType.toUpperCase()}`,
    amount: claimedValue,
    verification_status: verdict,
  });

  return {
    is_verified: isVerified,
    actual_value: actualValue,
    claimed_value: claimedValue,
    discrepancy,
    rationale,
    verdict,
    product: product as MerchantProduct,
  };
}
