import express from "express";
import {
  createReview,
  deleteReview,
  getMyReviews,
  getProductReviews,
} from "../controller/review.controller.js";

const router = express.Router();

router.post("/create", createReview);
router.get("/my-reviews", getMyReviews);
router.get("/product/:productId", getProductReviews);
router.delete("/delete", deleteReview);

export default router;
