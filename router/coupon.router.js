import express from "express";
import {
  getAvailableCoupons,
  validateCoupon,
} from "../controller/coupon.controller.js";

const router = express.Router();

router.get("/available", getAvailableCoupons);
router.post("/validate", validateCoupon);

export default router;
