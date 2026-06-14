import express from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUser,
  updateUserRole,
} from "../controller/user.controller.js";

const router = express.Router();

router.post("/createUser", createUser);
router.get("/getUser", getUser);
router.get("/getAllUsers", getAllUsers);
router.put("/updateUserRole", updateUserRole);
router.delete("/deleteUser", deleteUser);

export default router;
