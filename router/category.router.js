import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
} from "../controller/category.controller.js";
import { upload } from "../services/multer.js";

const router = express.Router();

router.post("/create", upload.single("thumbnail"), createCategory);
router.get("/getAllCategories", getAllCategories);
router.delete("/deleteCategory", deleteCategory);

export default router;
