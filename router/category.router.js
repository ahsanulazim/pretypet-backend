import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  updateCategory,
} from "../controller/category.controller.js";
import { upload } from "../services/multer.js";

const router = express.Router();

router.post("/create", upload.single("thumbnail"), createCategory);
router.get("/getAllCategories", getAllCategories);
router.delete("/deleteCategory", deleteCategory);
router.get("/getCategory", getCategory);
router.put("/updateCategory", upload.single("thumbnail"), updateCategory);

export default router;
