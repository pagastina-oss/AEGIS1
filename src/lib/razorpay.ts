import { supabase } from './supabase';
import type { Payment } from './types';

export async function createOrder(amount: number, disputeId?: string): Promise<{ order_id: string; amount: number; status: string }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-proxy`;
  const headers = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'create-order', amount, currency: 'INR', dispute_id: disputeId }),
  });

  if (!response.ok) throw new Error(`Failed to create order (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return { order_id: data.order_id, amount: data.amount, status: data.status };
}

export async function capturePayment(orderId: string): Promise<{ payment_id: string; status: string }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-proxy`;
  const headers = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'capture', order_id: orderId }),
  });

  if (!response.ok) throw new Error(`Failed to capture payment (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return { payment_id: data.payment_id, status: data.status };
}

export async function refundPayment(paymentId: string): Promise<{ status: string }> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-proxy`;
  const headers = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'refund', payment_id: paymentId }),
  });

  if (!response.ok) throw new Error(`Failed to process refund (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return { status: data.status };
}

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as Payment[];
}
