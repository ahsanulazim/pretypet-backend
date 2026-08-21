import { ObjectId } from "mongodb";
import { brandCollection } from "../collections/collections.js";
import cloudinary from "../lib/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryHelper.js";

export const createBrand = async (req, res) => {
  try {
    const { label, value } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer);

    if (!uploadResult) {
      return res.status(500).json({ error: "File upload failed" });
    }

    const newBrand = {
      label,
      value,
      logo: {
        url: uploadResult.url,
        public_id: uploadResult.publicId,
      },
      createdAt: new Date(),
    };

    await brandCollection.insertOne(newBrand);

    res
      .status(201)
      .json({ success: true, message: "Brand created successfully" });
  } catch (error) {
    console.log("Error creating brand:", error);
    if (error.publicId) {
      await cloudinary.uploader.destroy(error.publicId);
    }
    res.status(500).json({ success: false, message: "Failed to create brand" });
  }
};

export const getAllBrands = async (req, res) => {
  try {
    const brands = await brandCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ success: false, message: "Cannot get Brands" });
  }
};

export const deleteBrand = async (req, res) => {
  const { id } = req.query;
  try {
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid brand ID" });
    }

    const brand = await brandCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Cannot Find Brand" });
    }

    if (brand.logo) {
      try {
        await cloudinary.uploader.destroy(brand.logo.public_id);
      } catch (error) {
        console.error("Cloudinary Error", error);
      }
    }

    await brandCollection.deleteOne({ _id: new ObjectId(id) });
    return res.status(200).json({ success: true, message: "Brand Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete Brand" });
  }
};
