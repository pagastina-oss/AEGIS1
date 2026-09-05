import { supabase } from '../supabase';
import { createOrder, capturePayment } from '../razorpay';
import type { CommerceResult, MerchantProduct } from '../types';

export async function executePurchase(
  productId: string,
  budget: number
): Promise<CommerceResult> {
  const { data: product, error } = await supabase
    .from('merchant_products')
    .select('*')
    .eq('product_id', productId.toUpperCase())
    .maybeSingle();

  if (error) throw error;

  if (!product) {
    return {
      product: null,
      list_price: 0,
      negotiated_price: 0,
      discount_applied: 0,
      order_id: '',
      payment_id: '',
      payment_status: 'FAILED',
      revenue: 0,
      negotiation_steps: [`Product ${productId} not found in catalog.`],
      verdict: 'PURCHASE_FAILED',
    };
  }

  const typedProduct = product as MerchantProduct;
  const listPrice = typedProduct.price;
  const steps: string[] = [];

  steps.push(`Searching catalog...`);
  steps.push(`Found product: ${typedProduct.name} - ₹${listPrice}`);

  if (budget < listPrice * 0.5) {
    steps.push(`Agent-A1 (Commerce): Budget ₹${budget} is too low for this product (min 50% of list price).`);
    return {
      product: typedProduct,
      list_price: listPrice,
      negotiated_price: 0,
      discount_applied: 0,
      order_id: '',
      payment_id: '',
      payment_status: 'CANCELLED',
      revenue: 0,
      negotiation_steps: steps,
      verdict: 'PURCHASE_FAILED',
    };
  }

  steps.push(`Negotiating with seller...`);

  const catalogDiscount = typedProduct.discount;
  let negotiatedDiscount = catalogDiscount;

  if (budget < listPrice) {
    const neededDiscount = Math.ceil(((listPrice - budget) / listPrice) * 100);
    steps.push(`Agent-A2 (Seller): Can offer ${Math.min(neededDiscount - catalogDiscount, 10)}% additional discount on top of catalog ${catalogDiscount}%.`);
    negotiatedDiscount = Math.min(neededDiscount, catalogDiscount + 10);
  } else if (budget >= listPrice) {
    steps.push(`Agent-A2 (Seller): Applying catalog discount of ${catalogDiscount}%.`);
    if (budget >= listPrice * 2) {
      steps.push(`Agent-A1 (Commerce): High budget detected. Negotiating for additional 5% bulk discount...`);
      steps.push(`Agent-A2 (Seller): Approved bulk discount. Total: ${catalogDiscount + 5}%`);
      negotiatedDiscount = catalogDiscount + 5;
    }
  }

  const negotiatedPrice = Math.round(listPrice * (1 - negotiatedDiscount / 100));
  steps.push(`Discount applied: ${negotiatedDiscount}%`);

  if (negotiatedPrice > budget) {
    steps.push(`Agent-A1 (Commerce): Negotiated price exceeds budget. Purchase cancelled.`);
    return {
      product: typedProduct,
      list_price: listPrice,
      negotiated_price: negotiatedPrice,
      discount_applied: negotiatedDiscount,
      order_id: '',
      payment_id: '',
      payment_status: 'CANCELLED',
      revenue: 0,
      negotiation_steps: steps,
      verdict: 'PURCHASE_FAILED',
    };
  }

  steps.push(`Creating Razorpay order...`);

  const order = await createOrder(negotiatedPrice);
  steps.push(`Agent-A1 (Commerce): Order created — ${order.order_id}`);

  steps.push(`Agent-A1 (Commerce): Initiating checkout flow... Capturing payment via Razorpay test mode...`);
  const capture = await capturePayment(order.order_id);
  steps.push(`Payment captured: ₹${negotiatedPrice}`);

  steps.push(`Order confirmed: ${typedProduct.name} purchased at ₹${negotiatedPrice}`);

  await supabase.from('agent_actions').insert({
    agent_id: 'A1',
    user_id: 'U001',
    action_type: 'COMMERCE_PURCHASE',
    amount: negotiatedPrice,
    verification_status: 'PURCHASE_COMPLETE',
  });

  return {
    product: typedProduct,
    list_price: listPrice,
    negotiated_price: negotiatedPrice,
    discount_applied: negotiatedDiscount,
    order_id: order.order_id,
    payment_id: capture.payment_id,
    payment_status: capture.status,
    revenue: negotiatedPrice,
    negotiation_steps: steps,
    verdict: 'PURCHASE_COMPLETE',
  };
}
