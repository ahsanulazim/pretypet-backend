import { ObjectId } from "mongodb";
import { attributeCollection } from "../collections/collections.js";

export const createAttribute = async (req, res) => {
  const { name, slug, variations } = req.body;

  if (!name || !slug || !variations) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  const createdAt = new Date();
  const updatedAt = new Date();

  const options = variations.map((v) => ({
    value: v.toLowerCase().replace(/\s+/g, "-"),
    label: v,
  }));

  const newAttribute = {
    name,
    slug,
    value: slug,
    options,
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
      .sort({ name: 1 })
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

export const getAttribute = async (req, res) => {
  const { slug } = req.query;

  try {
    const attribute = await attributeCollection.findOne({ slug });
    if (!attribute) {
      return res
        .status(404)
        .json({ success: false, message: "Attribute not found" });
    }
    res.status(200).json(attribute);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Attribute finding Failed" });
  }
};

export const updateAttribute = async (req, res) => {
  const { id } = req.query;
  const { name, slug, variations } = req.body;
  const updatedAt = new Date();
  const options = variations.map((v) => ({
    value: v.toLowerCase().replace(/\s+/g, "-"),
    label: v,
  }));
  try {
    const result = await attributeCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, slug, value: slug, options, updatedAt } },
    );
    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Attribute not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Attribute updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Attribute update failed" });
  }
};
