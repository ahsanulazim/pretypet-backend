import {
  attributeCollection,
  variantsCollection,
} from "../collections/collections.js";

export const createVariant = async (req, res) => {
  const { name, slug, attributeSlug, value } = req.body;

  if (!name || !slug || !attributeSlug || !value) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  const createdAt = new Date();
  const updatedAt = new Date();

  const attribute = await attributeCollection.findOne({ slug: attributeSlug });
  if (!attribute) {
    return res
      .status(400)
      .json({ success: false, message: "Attribute not found" });
  }

  const newVariant = {
    name,
    slug,
    attributeSlug,
    attributeType: attribute.attributeType,
    value,
    createdAt,
    updatedAt,
  };

  try {
    await variantsCollection.insertOne(newVariant);
    res
      .status(201)
      .json({ success: true, message: "Variant created successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Variant creation Failed" });
  }
};

export const getAllVariants = async (req, res) => {
  const { attributeSlug } = req.query;

  if (!attributeSlug) {
    return res
      .status(400)
      .json({ success: false, message: "Attribute slug is required" });
  }

  try {
    const variants = await variantsCollection
      .find({
        attributeSlug,
      })
      .toArray();

    res.status(200).json(variants);
  } catch (error) {
    res.status(500).json({ success: false, message: "Variant finding failed" });
  }
};

export const getAllAttributesVariants = async (req, res) => {
  try {
    const variants = await variantsCollection.find().toArray();

    res.status(200).json(variants);
  } catch (error) {
    res.status(500).json({ success: false, message: "Variant finding failed" });
  }
};

export const deleteVariant = async (req, res) => {
  const { slug } = req.query;

  if (!slug) {
    return res
      .status(400)
      .json({ success: false, message: "Variant slug is required" });
  }

  try {
    await variantsCollection.deleteOne({ slug });
    res
      .status(200)
      .json({ success: true, message: "Variant deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Variant deletion failed" });
  }
};
