import rateLimit from "express-rate-limit";

// প্রতি মিনিটে সর্বোচ্চ 60 API কল
export const cjRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // প্রতি মিনিটে 60 কল
  message: {
    success: false,
    message: "CJ API rate limit exceeded. Please try again later.",
  },
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});
