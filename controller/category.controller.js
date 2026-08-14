import { ObjectId } from "mongodb";
import { categoryCollection } from "../collections/collections.js";
import cloudinary from "../lib/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryHelper.js";

export const createCategory = async (req, res) => {
  const { name, slug } = req.body;
  const createdAt = new Date();
  const updatedAt = new Date();

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const uploadResult = await uploadToCloudinary(req.file.buffer);

  if (!uploadResult) {
    return res.status(500).json({ error: "File upload failed" });
  }

  const category = {
    name,
    slug,
    thumbnail: {
      url: uploadResult.url,
      public_id: uploadResult.publicId,
    },
    createdAt,
    updatedAt,
  };

  try {
    await categoryCollection.insertOne(category);
    res.status(201).json({ success: true, message: "Category is created" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Ctegory creation Failed" });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Cannot get Categories" });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.query;
  try {
    const category = await categoryCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      res.status(404).json({ success: false, message: "Cannot Find Category" });
    }

    if (category.coverThumbnail) {
      const deleteImage = category.coverThumbnail.split("/").pop().split(".");
      try {
        await cloudinary.uploader.destroy(`category/${deleteImage}`);
      } catch (error) {
        console.error("Cloudinary Error", error);
      }
    }

    await categoryCollection.deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ success: true, message: "Category Deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete category" });
  }
};
