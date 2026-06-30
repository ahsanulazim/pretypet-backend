import express from "express";
import {
  addProductToStore,
  cjGetProducts,
  cjSearchProducts,
  deleteProduct,
  getAllProducts,
  getAllStoreProducts,
  getCjProductDetails,
  getListedProducts,
  getNewArriavals,
  getProductByPid,
} from "../controller/product.controller.js";
import { cjRateLimiter } from "../middleware/cjRateLimiter.js";

const router = express.Router();

//routes
router.get("/cj/products", cjRateLimiter, cjGetProducts);
router.get("/cj/search", cjRateLimiter, cjSearchProducts);
router.get("/cj/product/:productId", cjRateLimiter, getCjProductDetails);
router.get("/cj/getAllStoreProducts", getAllStoreProducts);
router.get("/getAllProducts", getAllProducts);
router.get("/getNewArrivals", getNewArriavals);
router.get("/getProductByPid", getProductByPid);
router.get("/cj/getListedProducts", cjRateLimiter, getListedProducts);
router.post("/add", cjRateLimiter, addProductToStore);
router.delete("/delete/:productId", cjRateLimiter, deleteProduct);

export default router;
