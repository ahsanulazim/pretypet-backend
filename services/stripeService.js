import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const isStripeConfigured =
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  !process.env.STRIPE_SECRET_KEY.includes("placeholder");

const stripe = isStripeConfigured
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Creates a Stripe Checkout Session for an order
 */
export const createStripeCheckoutSession = async ({ order, clientUrl }) => {
  const baseUrl = clientUrl || process.env.CLIENT_URL || "http://localhost:3000";

  // Fallback simulation when real Stripe key has not been pasted yet
  if (!stripe) {
    console.warn(
      "⚠️ [Stripe] STRIPE_SECRET_KEY is not configured with a valid key. Running in developer test mode.",
    );
    return {
      id: `sim_session_${order.orderNumber}`,
      url: `${baseUrl}/cart/checkout/payment-success?session_id=sim_${order.orderNumber}&order_id=${order._id}&order_number=${order.orderNumber}`,
      isSimulated: true,
    };
  }

  // 1. Build line items for products
  const lineItems = order.products.map((prod) => {
    const itemPrice = Number(prod.finalPrice || prod.price || 0);
    const unitAmount = Math.max(50, Math.round(itemPrice * 100)); // Stripe min 50 cents

    const productData = {
      name: prod.title || "Pet Product",
      metadata: {
        productId: String(prod.productId || ""),
        sku: String(prod.sku || ""),
      },
    };

    if (prod.thumbnail && typeof prod.thumbnail === "string" && prod.thumbnail.startsWith("http")) {
      productData.images = [prod.thumbnail];
    }

    return {
      price_data: {
        currency: "usd",
        product_data: productData,
        unit_amount: unitAmount,
      },
      quantity: Math.max(1, parseInt(prod.quantity) || 1),
    };
  });

  // 2. Add shipping as an explicit line item if applicable
  const shippingFee = Number(order.shippingCost || 0);
  if (shippingFee > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Shipping: ${order.shipping?.name || "Standard Delivery"} (${order.shipping?.aging || "4-7 days"})`,
        },
        unit_amount: Math.round(shippingFee * 100),
      },
      quantity: 1,
    });
  }

  // 3. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: order.customer?.email || undefined,
    line_items: lineItems,
    success_url: `${baseUrl}/cart/checkout/payment-success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}&order_number=${order.orderNumber}`,
    cancel_url: `${baseUrl}/cart/checkout/payment-cancelled?order_id=${order._id}`,
    metadata: {
      orderId: String(order._id),
      orderNumber: String(order.orderNumber),
      customerEmail: String(order.customer?.email || ""),
    },
  });

  return session;
};

/**
 * Retrieves a checkout session from Stripe to verify payment status
 */
export const verifyStripePayment = async (sessionId) => {
  if (!sessionId) {
    throw new Error("Session ID is required to verify payment");
  }

  if (sessionId.startsWith("sim_") || !stripe) {
    return {
      paid: true,
      sessionId,
      isSimulated: true,
      amountTotal: 0,
      currency: "usd",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const isPaid = session.payment_status === "paid";

  return {
    paid: isPaid,
    sessionId: session.id,
    orderId: session.metadata?.orderId,
    orderNumber: session.metadata?.orderNumber,
    customerEmail: session.customer_details?.email || session.metadata?.customerEmail,
    amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    currency: session.currency,
  };
};

export default stripe;
