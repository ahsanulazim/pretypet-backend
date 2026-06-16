import express from "express";
import {
  createAttribute,
  deleteAttribute,
  getAllAttributes,
} from "../controller/attribute.controller.js";

const router = express.Router();

//Routes
router.post("/createAttribute", createAttribute);
router.get("/getAllAttributes", getAllAttributes);
router.delete("/deleteAttribute", deleteAttribute);

export default router;
