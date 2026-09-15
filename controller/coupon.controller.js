const DEFAULT_COUPONS = [
  {
    code: "WELCOME10",
    title: "New Member Welcome Gift",
    description: "Get 10% off your entire pet supplies order",
    discountType: "percent",
    discountValue: 10,
    minSpend: 25,
    category: "All Products",
    expiresInDays: 30,
    badge: "10% OFF",
    tag: "Welcome",
  },
  {
    code: "PRETYPET15",
    title: "PretyPet VIP Pet Parent",
    description: "Enjoy 15% off quality food, treats, and toys",
    discountType: "percent",
    discountValue: 15,
    minSpend: 50,
    category: "Food & Treats",
    expiresInDays: 14,
    badge: "15% OFF",
    tag: "VIP Special",
  },
  {
    code: "FREESHIP",
    title: "Free Express Shipping",
    description: "Free delivery to your doorstep on orders over $35",
    discountType: "shipping",
    discountValue: 0,
    minSpend: 35,
    category: "Shipping",
    expiresInDays: 60,
    badge: "FREE SHIPPING",
    tag: "Popular",
  },
  {
    code: "PAWLOVE",
    title: "Paws & Whiskers Flat Discount",
    description: "Save $10 flat on grooming & pet accessories",
    discountType: "flat",
    discountValue: 10,
    minSpend: 60,
    category: "Accessories",
    expiresInDays: 21,
    badge: "$10 OFF",
    tag: "Save Big",
  },
  {
    code: "PETBDAY20",
    title: "Happy Pet Birthday Celebration 🎂",
    description: "Special 20% birthday month voucher for your pet companion",
    discountType: "percent",
    discountValue: 20,
    minSpend: 20,
    category: "Birthday Treats",
    expiresInDays: 45,
    badge: "20% OFF",
    tag: "Birthday Club",
  },
];

/**
 * 1. Get available coupons for customer
 */
export const getAvailableCoupons = async (req, res, next) => {
  try {
    const coupons = DEFAULT_COUPONS.map((coupon) => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + coupon.expiresInDays);
      return {
        ...coupon,
        expiresAt: expiry.toISOString(),
        isActive: true,
      };
    });

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("Error in getAvailableCoupons:", error);
    next(error);
  }
};

/**
 * 2. Validate coupon code for checkout
 */
export const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = DEFAULT_COUPONS.find(
      (c) => c.code.toUpperCase() === code.trim().toUpperCase()
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid promo code" });
    }

    if (subtotal < coupon.minSpend) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${coupon.minSpend} required for code ${coupon.code}`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === "percent") {
      discountAmount = (subtotal * coupon.discountValue) / 100;
    } else if (coupon.discountType === "flat") {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    } else if (coupon.discountType === "shipping") {
      discountAmount = 0; // Handled as free shipping
    }

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Number(discountAmount.toFixed(2)),
      },
      message: `Coupon ${coupon.code} applied successfully!`,
    });
  } catch (error) {
    console.error("Error in validateCoupon:", error);
    next(error);
  }
};
