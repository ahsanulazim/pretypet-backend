import auth from "../admin/firebase.config.js";
import { userCollection } from "../collections/collections.js";

export const createUser = async (req, res) => {
  const { name, email } = req.body;
  const role = "user";
  const createdAt = new Date();
  const updatedAt = new Date();

  const newUser = {
    name,
    email,
    role,
    createdAt,
    updatedAt,
  };

  // Validate input
  if (!name || !email) {
    return res
      .status(400)
      .json({ success: false, message: "Name and email are required" });
  }

  try {
    await userCollection.insertOne(newUser);
    res
      .status(201)
      .json({ success: true, message: "User created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    res.status(500).json({ success: false, message: "Error creating user" });
  }
};

export const getUser = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  try {
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  try {
    const users = await userCollection
      .find({ role: "user" })
      .skip(skip)
      .limit(limit)
      .toArray();
    const totalUsers = await userCollection.countDocuments({ role: "user" });
    const totalPages = Math.ceil(totalUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      users,
      totalUsers,
      totalPages,
      hasNextPage,
      hasPrevPage,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ message: "Email and role are required" });
  }
  try {
    const result = await userCollection.updateOne(
      { email },
      { $set: { role, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User role updated successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user role", error });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  const email = req.query.email;
  try {
    const userRecord = await auth.getUserByEmail(email);
    await auth.deleteUser(userRecord.uid);
    const result = await userCollection.deleteOne({ email });
    if (result.deletedCount > 0) {
      return res.send({ success: true, message: "User deleted successfully" });
    } else {
      return res.send({ success: false, message: "User not found in MongoDB" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    return res
      .status(500)
      .send({ success: false, message: "Failed to delete user" });
  }
};
