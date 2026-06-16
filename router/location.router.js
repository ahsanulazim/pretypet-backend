import express from "express";
import {
  getAllLocations,
  getStates,
} from "../controller/location.controller.js";

const router = express.Router();

//routes
router.get("/getAllLocations", getAllLocations);
router.get("/getStates", getStates);

export default router;
