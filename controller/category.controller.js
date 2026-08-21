import { ObjectId } from "mongodb";
import { categoryCollection } from "../collections/collections.js";
import cloudinary from "../lib/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryHelper.js";

export const createCategory = async (req, res) => {
  const { name, slug, description } = req.body;
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
    description: description || null,
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

//get a category
export const getCategory = async (req, res) => {
  const { id } = req.query;
  try {
    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID" });
    }

    const category = await categoryCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Cannot Find Category" });
    }

    return res.status(200).json(category);
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get category" });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryCollection
      .aggregate([
        {
          $lookup: {
            from: "products",
            localField: "slug",
            foreignField: "category",
            as: "products",
          },
        },
        {
          $addFields: {
            itemsCount: { $size: "$products" },
          },
        },
        {
          $project: {
            products: 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ])
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
    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category ID" });
    }

    const category = await categoryCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Cannot Find Category" });
    }

    if (category?.thumbnail?.public_id) {
      try {
        await cloudinary.uploader.destroy(category.thumbnail.public_id);
      } catch (error) {
        console.error("Cloudinary Error", error);
      }
    }

    await categoryCollection.deleteOne({ _id: new ObjectId(id) });
    return res.status(200).json({ success: true, message: "Category Deleted" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete category" });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.query;

  if (!id || !ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid category ID" });
  }

  try {
    const category = await categoryCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const { name, slug, description } = req.body;
    const updatedAt = new Date();

    let thumbnail = category.thumbnail;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      if (!uploadResult) {
        return res
          .status(500)
          .json({ success: false, message: "File upload failed" });
      }

      // Clean up old image safely
      if (thumbnail?.public_id) {
        try {
          await cloudinary.uploader.destroy(thumbnail.public_id);
        } catch (err) {
          console.error("Cloudinary cleanup failed:", err);
        }
      }

      thumbnail = {
        url: uploadResult.url,
        public_id: uploadResult.publicId,
      };
    }

    const updatePayload = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description && { description }),
      thumbnail,
      updatedAt,
    };

    await categoryCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatePayload },
    );

    return res.status(200).json({ success: true, message: "Category Updated" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to update category" });
  }
};
