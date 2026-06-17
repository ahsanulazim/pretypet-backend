import express from "express";
import {
  createVariant,
  deleteVariant,
  getAllVariants,
} from "../controller/variant.controller.js";

const router = express.Router();

//routes
router.post("/createVariant", createVariant);
router.get("/getAllVariants", getAllVariants);
router.delete("/deleteVariant", deleteVariant);

export default router;
