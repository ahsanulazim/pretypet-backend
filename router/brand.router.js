import express from "express";
import {
  createBrand,
  deleteBrand,
  getAllBrands,
} from "../controller/brand.controller.js";
import { upload } from "../services/multer.js";

const router = express.Router();

router.post("/createBrand", upload.single("logo"), createBrand);
router.get("/getAllBrands", getAllBrands);
router.delete("/deleteBrand", deleteBrand);
export default router;
