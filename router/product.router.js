import express from "express";
import multer from "multer";
import {
  addProductToStore,
  cjGetProducts,
  cjSearchProducts,
  createProduct,
  createProductStepper,
  deleteProduct,
  deleteProductStepper,
  getAllProducts,
  getAllStoreProducts,
  getCjProductDetails,
  getListedProducts,
  getNewArriavals,
  getProductByPid,
  getProductBySlug,
  getProductById,
  getProductsByCategory,
  updateProductStepper,
} from "../controller/product.controller.js";
import { cjRateLimiter } from "../middleware/cjRateLimiter.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

//routes
router.get("/cj/products", cjRateLimiter, cjGetProducts);
router.get("/cj/search", cjRateLimiter, cjSearchProducts);
router.get("/cj/getProduct", cjRateLimiter, getCjProductDetails);
router.get("/cj/getAllStoreProducts", getAllStoreProducts);
router.get("/getAllProducts", getAllProducts);
router.get("/getNewArrivals", getNewArriavals);
router.get("/getProductByPid", getProductByPid);
router.get("/getProductsByCategory", getProductsByCategory);
router.get("/getProductBySlug", getProductBySlug);
router.get("/getProductById", getProductById);
router.get("/cj/getListedProducts", cjRateLimiter, getListedProducts);
router.post("/add", cjRateLimiter, addProductToStore);
router.delete("/delete", deleteProduct);
router.delete("/deleteProductStepper", deleteProductStepper);
router.post("/createProduct", createProduct);
router.post("/createProductStepper", createProductStepper);
router.put("/updateProductStepper", updateProductStepper);

export default router;
