import admin from "../admin/firebase.config.js";
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
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(userRecord.uid);
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
  }
};

// Update user profile (name, phone)
export const updateUserProfile = async (req, res) => {
  const { email, name, phone, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const updateFields = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (avatar !== undefined) updateFields.avatar = avatar;

    const result = await userCollection.findOneAndUpdate(
      { email },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: result,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// Pet Management (Add, Update, Delete)
export const addPet = async (req, res) => {
  const { email, name, type, breed, birthDate, weight, allergies, notes } = req.body;
  if (!email || !name) {
    return res.status(400).json({ success: false, message: "Email and pet name are required" });
  }

  const newPet = {
    id: `pet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name,
    type: type || "Dog",
    breed: breed || "Mixed / Unknown",
    birthDate: birthDate || null,
    weight: weight || "",
    allergies: allergies || "",
    notes: notes || "",
    createdAt: new Date(),
  };

  try {
    const result = await userCollection.findOneAndUpdate(
      { email },
      { $push: { pets: newPet }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(201).json({
      success: true,
      message: "Pet added successfully",
      pets: result.pets || [],
    });
  } catch (error) {
    console.error("Error adding pet:", error);
    res.status(500).json({ success: false, message: "Failed to add pet" });
  }
};

export const deletePet = async (req, res) => {
  const { email, petId } = req.query;
  if (!email || !petId) {
    return res.status(400).json({ success: false, message: "Email and petId are required" });
  }

  try {
    const result = await userCollection.findOneAndUpdate(
      { email },
      { $pull: { pets: { id: petId } }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Pet removed successfully",
      pets: (result.pets || []).filter((p) => p.id !== petId),
    });
  } catch (error) {
    console.error("Error deleting pet:", error);
    res.status(500).json({ success: false, message: "Failed to delete pet" });
  }
};

// Address Management (Add, Delete, Set Default)
export const addAddress = async (req, res) => {
  const { email, label, fullName, phone, street, city, state, zip, country, isDefault } = req.body;
  if (!email || !fullName || !street || !city) {
    return res.status(400).json({ success: false, message: "Required address fields are missing" });
  }

  const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const newAddress = {
    id: addressId,
    label: label || "Home",
    fullName,
    phone: phone || "",
    street,
    city,
    state: state || "",
    zip: zip || "",
    country: country || "US",
    isDefault: Boolean(isDefault),
    createdAt: new Date(),
  };

  try {
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let existingAddresses = user.addresses || [];
    // If setting as default or if first address, make it default
    if (newAddress.isDefault || existingAddresses.length === 0) {
      existingAddresses = existingAddresses.map((a) => ({ ...a, isDefault: false }));
      newAddress.isDefault = true;
    }

    const updatedAddresses = [...existingAddresses, newAddress];

    await userCollection.updateOne(
      { email },
      { $set: { addresses: updatedAddresses, updatedAt: new Date() } }
    );

    res.status(201).json({
      success: true,
      message: "Address saved successfully",
      addresses: updatedAddresses,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Failed to save address" });
  }
};

export const deleteAddress = async (req, res) => {
  const { email, addressId } = req.query;
  if (!email || !addressId) {
    return res.status(400).json({ success: false, message: "Email and addressId are required" });
  }

  try {
    const result = await userCollection.findOneAndUpdate(
      { email },
      { $pull: { addresses: { id: addressId } }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Address removed successfully",
      addresses: (result.addresses || []).filter((a) => a.id !== addressId),
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
};

export const setDefaultAddress = async (req, res) => {
  const { email, addressId } = req.body;
  if (!email || !addressId) {
    return res.status(400).json({ success: false, message: "Email and addressId are required" });
  }

  try {
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedAddresses = (user.addresses || []).map((addr) => ({
      ...addr,
      isDefault: addr.id === addressId,
    }));

    await userCollection.updateOne(
      { email },
      { $set: { addresses: updatedAddresses, updatedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: "Default address updated",
      addresses: updatedAddresses,
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({ success: false, message: "Failed to set default address" });
  }
};

// Wishlist Management
export const toggleWishlist = async (req, res) => {
  const { email, productId } = req.body;
  if (!email || !productId) {
    return res.status(400).json({ success: false, message: "Email and productId are required" });
  }

  try {
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentWishlist = user.wishlist || [];
    const exists = currentWishlist.includes(productId);

    const updateQuery = exists
      ? { $pull: { wishlist: productId } }
      : { $addToSet: { wishlist: productId } };

    await userCollection.updateOne({ email }, { ...updateQuery, $set: { updatedAt: new Date() } });

    const updatedUser = await userCollection.findOne({ email });
    res.status(200).json({
      success: true,
      isSaved: !exists,
      wishlist: updatedUser.wishlist || [],
      message: !exists ? "Added to wishlist" : "Removed from wishlist",
    });
  } catch (error) {
    console.error("Error toggling wishlist:", error);
    res.status(500).json({ success: false, message: "Failed to update wishlist" });
  }
};
