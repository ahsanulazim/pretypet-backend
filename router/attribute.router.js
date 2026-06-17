import express from "express";
import {
  createAttribute,
  deleteAttribute,
  getAllAttributes,
  getAttribute,
} from "../controller/attribute.controller.js";

const router = express.Router();

//Routes
router.post("/createAttribute", createAttribute);
router.get("/getAllAttributes", getAllAttributes);
router.get("/getAttribute", getAttribute);
router.delete("/deleteAttribute", deleteAttribute);

export default router;
