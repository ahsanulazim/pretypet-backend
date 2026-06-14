import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
} from "../controller/category.controller.js";

const router = express.Router();

router.post("/create", createCategory);
router.get("/getAllCategories", getAllCategories);
router.delete("/deleteCategory", deleteCategory);

export default router;
