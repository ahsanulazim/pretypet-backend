import { ObjectId } from "mongodb";
import { orderCollection } from "../collections/collections.js";
import {
  createStripeCheckoutSession,
  verifyStripePayment,
} from "../services/stripeService.js";

/**
 * Helper to normalize order document for consistent frontend consumption
 */
export const normalizeOrder = (doc) => {
  if (!doc) return null;

  const firstName = doc.customer?.firstName || "";
  const lastName = doc.customer?.lastName || "";
  const customerName =
    doc.customer?.name ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Guest Customer";

  const total = Number(doc.total ?? doc.totalPrice ?? 0);
  const subtotal = Number(doc.subtotal ?? total);
  const shippingCost = Number(doc.shippingCost ?? doc.shippingCharge ?? 0);

  const orderStatus = doc.orderStatus || doc.status || "pending";
  const paymentStatus = doc.paymentStatus || (doc.paidAt ? "paid" : "pending");

  const products = (doc.products || []).map((item) => ({
    productId: item.productId || item._id || "",
    title: item.title || item.productName || item.name || "Product",
    thumbnail: item.thumbnail || item.image || "",
    sku: item.sku || "",
    vid: item.vid || "",
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
    finalPrice: Number(item.finalPrice || item.price || 0),
    selectedAttributes: item.selectedAttributes || {},
  }));

  return {
    ...doc,
    _id: doc._id?.toString() || doc._id,
    orderNumber: doc.orderNumber || `PP-${String(doc._id).slice(-6)}`,
    customer: {
      ...doc.customer,
      name: customerName,
      firstName: doc.customer?.firstName || customerName.split(" ")[0] || "",
      lastName: doc.customer?.lastName || customerName.split(" ").slice(1).join(" ") || "",
      email: doc.customer?.email || "",
      phone: doc.customer?.phone || "",
      address: doc.customer?.address || "",
      city: doc.customer?.city || "",
      state: doc.customer?.state || "",
      zip: doc.customer?.zip || "",
      country: doc.customer?.country || "US",
    },
    products,
    subtotal,
    shippingCost,
    total,
    currency: doc.currency || "USD",
    paymentMethod: "stripe",
    paymentStatus,
    orderStatus,
    status: orderStatus, // backward compatibility
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
  };
};

/**
 * 1. Create Order & initialize Stripe Checkout Session
 */
export const createOrder = async (req, res, next) => {
  try {
    const {
      user = "guest",
      customer,
      products = [],
      shipping = null,
      shippingCost = 0,
      clientUrl,
    } = req.body;

    if (!customer || !customer.address || (!customer.firstName && !customer.name)) {
      return res.status(400).json({
        success: false,
        message: "Customer name and address are required",
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      });
    }

    // Generate clean readable order number
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `PP-${timestamp}-${random}`;

    // Financial calculations
    const computedSubtotal = products.reduce(
      (sum, it) =>
        sum + Number(it.finalPrice || it.price || 0) * Number(it.quantity || 1),
      0,
    );
    const finalShippingCost = Number(shippingCost ?? shipping?.price ?? 0);
    const finalTotal = Number((computedSubtotal + finalShippingCost).toFixed(2));

    const orderDoc = {
      orderNumber,
      user: typeof user === "object" ? user?.email || user?.uid || "registered" : user,
      customer: {
        firstName: customer.firstName || (customer.name ? customer.name.split(" ")[0] : ""),
        lastName: customer.lastName || (customer.name ? customer.name.split(" ").slice(1).join(" ") : ""),
        name: customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" "),
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zip: customer.zip || "",
        country: customer.country || "US",
        comment: customer.comment || "",
      },
      products: products.map((item) => ({
        productId: item.productId || item._id || "",
        title: item.title || item.name || "Pet Product",
        thumbnail: item.thumbnail || item.image || "",
        vid: item.vid || item.cjVid || "",
        sku: item.sku || item.cjSku || "",
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        finalPrice: Number(item.finalPrice || item.price) || 0,
        selectedAttributes: item.selectedAttributes || {},
      })),
      shipping: shipping
        ? {
            id: shipping.id || shipping.name || "standard",
            name: shipping.name || shipping.logisticName || "Standard Shipping",
            price: finalShippingCost,
            aging: shipping.aging || shipping.logisticAging || "4-7 days",
          }
        : null,
      subtotal: Number(computedSubtotal.toFixed(2)),
      shippingCost: finalShippingCost,
      total: finalTotal,
      currency: "USD",
      paymentMethod: "stripe",
      paymentStatus: "pending",
      orderStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await orderCollection.insertOne(orderDoc);
    orderDoc._id = insertResult.insertedId;

    // Initialize Stripe Session
    const session = await createStripeCheckoutSession({
      order: orderDoc,
      clientUrl: clientUrl || req.headers.origin,
    });

    await orderCollection.updateOne(
      { _id: orderDoc._id },
      { $set: { stripeSessionId: session.id, paymentUrl: session.url } },
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      orderId: orderDoc._id,
      orderNumber: orderDoc.orderNumber,
      paymentUrl: session.url,
      order: normalizeOrder(orderDoc),
    });
  } catch (error) {
    console.error("Error in createOrder:", error);
    next(error);
  }
};

/**
 * 2. Verify payment status upon return from Stripe
 */
export const verifyOrderPayment = async (req, res, next) => {
  try {
    const { session_id, order_id, order_number } = req.query;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Stripe session_id is required",
      });
    }

    const verification = await verifyStripePayment(session_id);

    let query = {};
    if (order_id && ObjectId.isValid(order_id)) {
      query._id = new ObjectId(order_id);
    } else if (order_number) {
      query.orderNumber = order_number;
    } else if (verification.orderId && ObjectId.isValid(verification.orderId)) {
      query._id = new ObjectId(verification.orderId);
    } else {
      query.stripeSessionId = session_id;
    }

    const existingOrder = await orderCollection.findOne(query);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order for this payment session was not found",
      });
    }

    if (verification.paid) {
      await orderCollection.updateOne(
        { _id: existingOrder._id },
        {
          $set: {
            paymentStatus: "paid",
            orderStatus: "processing",
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    }

    const updated = await orderCollection.findOne({ _id: existingOrder._id });
    res.json({
      success: true,
      paid: verification.paid,
      order: normalizeOrder(updated),
    });
  } catch (error) {
    console.error("Error in verifyOrderPayment:", error);
    next(error);
  }
};

/**
 * 3. Get all orders with search, filters, and pagination
 */
export const getAllOrderData = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { search, orderStatus, paymentStatus } = req.query;

    const query = {};

    // Filter by orderStatus
    if (orderStatus && orderStatus !== "all") {
      query.$or = [{ orderStatus }, { status: orderStatus }];
    }

    // Filter by paymentStatus
    if (paymentStatus && paymentStatus !== "all") {
      query.paymentStatus = paymentStatus;
    }

    // Live search by order number, customer name, email, phone
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const searchConditions = [
        { orderNumber: regex },
        { "customer.firstName": regex },
        { "customer.lastName": regex },
        { "customer.name": regex },
        { "customer.email": regex },
        { "customer.phone": regex },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const [orders, total] = await Promise.all([
      orderCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      orderCollection.countDocuments(query),
    ]);

    res.json({
      success: true,
      orders: orders.map(normalizeOrder),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error in getAllOrderData:", error);
    next(error);
  }
};

/**
 * 4. Get single order details
 */
export const getOrderDetails = async (req, res, next) => {
  try {
    const orderId = req.query.orderId || req.query.id || req.query.order;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID or order number is required",
      });
    }

    let query = {};
    if (ObjectId.isValid(orderId)) {
      query = { $or: [{ _id: new ObjectId(orderId) }, { orderNumber: orderId }] };
    } else {
      query = { orderNumber: orderId };
    }

    const order = await orderCollection.findOne(query);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order: normalizeOrder(order),
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    next(error);
  }
};

/**
 * 5. Update Order Status, Payment Status, or Tracking
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId, orderStatus, paymentStatus, trackingNumber, note } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    let query = {};
    if (ObjectId.isValid(orderId)) {
      query = { _id: new ObjectId(orderId) };
    } else {
      query = { orderNumber: orderId };
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (orderStatus) {
      updateFields.orderStatus = orderStatus;
      updateFields.status = orderStatus;
      if (orderStatus === "delivered") {
        updateFields.deliveredAt = new Date();
      }
    }

    if (paymentStatus) {
      updateFields.paymentStatus = paymentStatus;
      if (paymentStatus === "paid" && !updateFields.paidAt) {
        updateFields.paidAt = new Date();
      }
    }

    if (trackingNumber !== undefined) {
      updateFields["shipping.trackingNumber"] = trackingNumber;
    }

    if (note) {
      updateFields.adminNote = note;
    }

    const result = await orderCollection.findOneAndUpdate(
      query,
      { $set: updateFields },
      { returnDocument: "after" },
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: normalizeOrder(result),
    });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    next(error);
  }
};

/**
 * 6. Get High-Level Order & Revenue Statistics for Dashboard
 */
export const getOrderStats = async (req, res, next) => {
  try {
    const [stats] = await orderCollection
      .aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  { $ifNull: ["$total", { $ifNull: ["$totalPrice", 0] }] },
                  0,
                ],
              },
            },
            pendingOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      { $ifNull: ["$orderStatus", "$status"] },
                      ["pending", "Pending"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            processingOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      { $ifNull: ["$orderStatus", "$status"] },
                      ["processing", "Processing"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            deliveredOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      { $ifNull: ["$orderStatus", "$status"] },
                      ["delivered", "Delivered"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            cancelledOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      { $ifNull: ["$orderStatus", "$status"] },
                      ["cancelled", "Cancelled"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            paidOrders: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    const result = stats || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      processingOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      paidOrders: 0,
    };

    delete result._id;
    result.totalRevenue = Number((result.totalRevenue || 0).toFixed(2));

    res.json({
      success: true,
      stats: result,
    });
  } catch (error) {
    console.error("Error in getOrderStats:", error);
    next(error);
  }
};

/**
 * 7. Delete Order
 */
export const deleteOrder = async (req, res, next) => {
  try {
    const id = req.query.id || req.body?.id || req.query.orderId;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid Order ID is required",
      });
    }

    const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error in deleteOrder:", error);
    next(error);
  }
};

/**
 * 8. Customer: Get orders belonging to customer
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const emailRegex = new RegExp(`^${email.trim()}$`, "i");
    const query = {
      $or: [
        { "customer.email": emailRegex },
        { "user.email": emailRegex },
        { email: emailRegex },
      ],
    };

    if (status && status !== "all") {
      query.$and = [{ $or: [{ orderStatus: status }, { status: status }] }];
    }

    const [orders, total] = await Promise.all([
      orderCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      orderCollection.countDocuments(query),
    ]);

    res.json({
      success: true,
      orders: orders.map(normalizeOrder),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error in getMyOrders:", error);
    next(error);
  }
};

/**
 * 9. Customer: Cancel pending order
 */
export const cancelMyOrder = async (req, res, next) => {
  try {
    const { orderId, email } = req.body;
    if (!orderId || !ObjectId.isValid(orderId) || !email) {
      return res.status(400).json({ success: false, message: "Valid orderId and email are required" });
    }

    const emailRegex = new RegExp(`^${email.trim()}$`, "i");
    const order = await orderCollection.findOne({
      _id: new ObjectId(orderId),
      $or: [
        { "customer.email": emailRegex },
        { "user.email": emailRegex },
        { email: emailRegex },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const currentStatus = order.orderStatus || order.status;
    if (currentStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be cancelled. Please contact support.",
      });
    }

    await orderCollection.updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { orderStatus: "cancelled", status: "cancelled", updatedAt: new Date() } }
    );

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error in cancelMyOrder:", error);
    next(error);
  }
};

