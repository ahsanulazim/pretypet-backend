import express from "express";
import {
  createOrder,
  verifyOrderPayment,
  getAllOrderData,
  getOrderDetails,
  updateOrderStatus,
  getOrderStats,
  deleteOrder,
  bulkDeleteOrders,
  getMyOrders,
  cancelMyOrder,
  fulfillCjOrder,
  bulkFulfillCjOrders,
  syncCjOrderStatus,
} from "../controller/order.controller.js";
import { cjRateLimiter } from "../middleware/cjRateLimiter.js";

const router = express.Router();

router.post("/createOrder", createOrder);
router.get("/verify-payment", verifyOrderPayment);
router.get("/getAllOrderData", getAllOrderData);
router.get("/getOrderDetails", getOrderDetails);
router.patch("/updateOrderStatus", updateOrderStatus);
router.get("/getOrderStats", getOrderStats);
router.delete("/deleteOrder", deleteOrder);
router.delete("/bulk-delete", bulkDeleteOrders);

// CJ Dropshipping fulfillment & tracking sync
router.post("/bulk-fulfill-cj", cjRateLimiter, bulkFulfillCjOrders);
router.post("/:id/fulfill-cj", cjRateLimiter, fulfillCjOrder);
router.post("/:id/sync-cj-status", cjRateLimiter, syncCjOrderStatus);

// Customer endpoints
router.get("/my-orders", getMyOrders);
router.post("/cancel-my-order", cancelMyOrder);

export default router;
