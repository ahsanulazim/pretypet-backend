import { ObjectId } from "mongodb";
import { attributeCollection } from "../collections/collections.js";

export const createAttribute = async (req, res) => {
  const { name, slug, attributeType } = req.body;

  if (!name || !slug || !attributeType) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  const createdAt = new Date();
  const updatedAt = new Date();

  const newAttribute = {
    name,
    slug,
    attributeType,
    createdAt,
    updatedAt,
  };

  try {
    await attributeCollection.insertOne(newAttribute);
    res
      .status(201)
      .json({ success: true, message: "Attribute created successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Attribute creation Failed" });
  }
};

export const getAllAttributes = async (req, res) => {
  try {
    const attributes = await attributeCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(attributes);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Attributes finding Failed" });
  }
};

export const deleteAttribute = async (req, res) => {
  const { slug } = req.query;

  try {
    await attributeCollection.deleteOne({ slug });
    res
      .status(200)
      .json({ success: true, message: "Attribute deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Attribute deletion Failed" });
  }
};
