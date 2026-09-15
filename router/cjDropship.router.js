import express from "express";
import {
  getCjImportList,
  getCjProductForImport,
  importProductToStore,
  syncCjProduct,
  updateStoreProduct,
  calculateCjShipping,
} from "../controller/cjDropship.controller.js";
import { cjRateLimiter } from "../middleware/cjRateLimiter.js";

const router = express.Router();

// 1. Fetch shortlisted products with MongoDB import status
router.get("/import-list", cjRateLimiter, getCjImportList);

// 2. Fetch full CJ product details formatted for the Customizer
router.get("/product-details", cjRateLimiter, getCjProductForImport);

// 3. Import & publish customized product into MongoDB
router.post("/import", importProductToStore);

// 4. Update existing product in MongoDB from unified customizer
router.put("/update/:id", updateStoreProduct);

// 5. Sync product inventory & cost price from CJ
router.post("/sync/:id", cjRateLimiter, syncCjProduct);

// 6. Calculate dynamic shipping options from CJ Dropshipping
router.post("/calculate-shipping", calculateCjShipping);

export default router;
