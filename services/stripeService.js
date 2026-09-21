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

const extractPaymentDetails = (paymentMethod, latestCharge) => {
  if (!paymentMethod || typeof paymentMethod !== "object") {
    return {
      gateway: "stripe",
      method: "card",
      brand: "card",
      last4: "",
      funding: null,
      wallet: null,
      receiptUrl: latestCharge?.receipt_url || null,
    };
  }

  const type = paymentMethod.type || "card";
  const card = paymentMethod.card || {};
  const walletType = card.wallet?.type || null;

  return {
    gateway: "stripe",
    method: walletType ? walletType : type,
    brand: card.brand || type,
    last4: card.last4 || "",
    funding: card.funding || null,
    wallet: walletType,
    receiptUrl: latestCharge?.receipt_url || null,
  };
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
      paymentDetails: {
        gateway: "stripe",
        method: "card",
        brand: "visa",
        last4: "4242",
        funding: "credit",
        wallet: null,
        isSimulated: true,
      },
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.payment_method", "payment_intent.latest_charge"],
  });
  const isPaid = session.payment_status === "paid";
  const pi =
    typeof session.payment_intent === "object" ? session.payment_intent : null;
  const paymentDetails = pi
    ? extractPaymentDetails(pi.payment_method, pi.latest_charge)
    : {
        gateway: "stripe",
        method: "card",
        brand: "card",
        last4: "",
        wallet: null,
      };

  return {
    paid: isPaid,
    sessionId: session.id,
    orderId: session.metadata?.orderId,
    orderNumber: session.metadata?.orderNumber,
    customerEmail: session.customer_details?.email || session.metadata?.customerEmail,
    amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    currency: session.currency,
    paymentDetails,
  };
};

/**
 * Creates a Stripe PaymentIntent for custom on-site checkout
 */
export const createStripePaymentIntent = async ({ order }) => {
  const totalAmount = Number(order.total || 0);
  const amountInCents = Math.max(50, Math.round(totalAmount * 100)); // Stripe min 50 cents

  if (!stripe) {
    console.warn(
      "⚠️ [Stripe] STRIPE_SECRET_KEY is not configured with a valid key. Running in developer test mode.",
    );
    return {
      id: `sim_pi_${order.orderNumber}`,
      clientSecret: `sim_secret_${order.orderNumber}`,
      isSimulated: true,
    };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    receipt_email: order.customer?.email || undefined,
    metadata: {
      orderId: String(order._id),
      orderNumber: String(order.orderNumber),
      customerEmail: String(order.customer?.email || ""),
    },
    description: `Order #${order.orderNumber} - PretyPet`,
  });

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
};

/**
 * Retrieves a PaymentIntent from Stripe to verify payment status
 */
export const verifyStripePaymentIntent = async (paymentIntentId) => {
  if (!paymentIntentId) {
    throw new Error("PaymentIntent ID is required to verify payment");
  }

  if (paymentIntentId.startsWith("sim_") || !stripe) {
    return {
      paid: true,
      paymentIntentId,
      isSimulated: true,
      amountTotal: 0,
      currency: "usd",
      paymentDetails: {
        gateway: "stripe",
        method: "card",
        brand: "visa",
        last4: "4242",
        funding: "credit",
        wallet: null,
        isSimulated: true,
      },
    };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method", "latest_charge"],
  });
  const isPaid = paymentIntent.status === "succeeded";
  const paymentDetails = extractPaymentDetails(
    paymentIntent.payment_method,
    paymentIntent.latest_charge,
  );

  return {
    paid: isPaid,
    status: paymentIntent.status,
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId,
    orderNumber: paymentIntent.metadata?.orderNumber,
    customerEmail:
      paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail,
    amountTotal: paymentIntent.amount ? paymentIntent.amount / 100 : 0,
    currency: paymentIntent.currency,
    paymentDetails,
  };
};

export default stripe;

