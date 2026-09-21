import express from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUser,
  updateUserRole,
  updateUserProfile,
  addPet,
  deletePet,
  addAddress,
  deleteAddress,
  setDefaultAddress,
  toggleWishlist,
  getWishlistProducts,
} from "../controller/user.controller.js";

const router = express.Router();

router.post("/createUser", createUser);
router.get("/getUser", getUser);
router.get("/getAllUsers", getAllUsers);
router.put("/updateUserRole", updateUserRole);
router.delete("/deleteUser", deleteUser);

// Customer Account APIs
router.put("/updateProfile", updateUserProfile);
router.post("/addPet", addPet);
router.delete("/deletePet", deletePet);
router.post("/addAddress", addAddress);
router.delete("/deleteAddress", deleteAddress);
router.patch("/setDefaultAddress", setDefaultAddress);
router.post("/toggleWishlist", toggleWishlist);
router.get("/wishlist-products", getWishlistProducts);

export default router;
