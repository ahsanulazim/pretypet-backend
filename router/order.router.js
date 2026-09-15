import express from "express";
import {
  createOrder,
  verifyOrderPayment,
  getAllOrderData,
  getOrderDetails,
  updateOrderStatus,
  getOrderStats,
  deleteOrder,
  getMyOrders,
  cancelMyOrder,
} from "../controller/order.controller.js";

const router = express.Router();

router.post("/createOrder", createOrder);
router.get("/verify-payment", verifyOrderPayment);
router.get("/getAllOrderData", getAllOrderData);
router.get("/getOrderDetails", getOrderDetails);
router.patch("/updateOrderStatus", updateOrderStatus);
router.get("/getOrderStats", getOrderStats);
router.delete("/deleteOrder", deleteOrder);

// Customer endpoints
router.get("/my-orders", getMyOrders);
router.post("/cancel-my-order", cancelMyOrder);

export default router;
