import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PaymentRequest {
  action: "create-order" | "capture" | "refund";
  amount?: number;
  currency?: string;
  payment_id?: string;
  order_id?: string;
  dispute_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: PaymentRequest = await req.json();
    const { action } = body;

    if (action === "create-order") {
      const amount = body.amount || 5000;
      const currency = body.currency || "INR";
      const orderId = `order_${Date.now()}`;

      const { data, error } = await supabase
        .from("payments")
        .insert({
          order_id: orderId,
          amount,
          currency,
          status: "CREATED",
          dispute_id: body.dispute_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          order_id: orderId,
          amount,
          currency,
          status: "CREATED",
          payment_record_id: data.id,
          message: "Test order created successfully (Razorpay test mode)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "capture") {
      const paymentId = body.payment_id || `pay_${Date.now()}`;
      const orderId = body.order_id || "";

      const { data: order } = await supabase
        .from("payments")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (!order) throw new Error("Order not found");

      const { error } = await supabase
        .from("payments")
        .update({ payment_id: paymentId, status: "CAPTURED" })
        .eq("order_id", orderId);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          payment_id: paymentId,
          order_id: orderId,
          amount: order.amount,
          currency: order.currency,
          status: "CAPTURED",
          message: "Payment captured successfully (Razorpay test mode)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refund") {
      const paymentId = body.payment_id || "";

      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (!payment) throw new Error("Payment not found");

      const { error } = await supabase
        .from("payments")
        .update({ status: "REFUNDED" })
        .eq("payment_id", paymentId);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          payment_id: paymentId,
          amount: payment.amount,
          currency: payment.currency,
          status: "REFUNDED",
          message: "Refund processed successfully (Razorpay test mode)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use create-order, capture, or refund." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
