import { ObjectId } from "mongodb";
import { carouselCollection } from "../collections/collections.js";
import cloudinary from "../lib/cloudinary.js";

// 1. Upload a new carousel slide
export const uploadCarousel = async (req, res) => {
  const { title, subtitle, link, openInNewTab, image, order, isActive } = req.body;

  if (!title || !image?.url) {
    return res.status(400).json({
      success: false,
      message: "Title and Image are required",
    });
  }

  const updatedAt = new Date();
  const createdAt = new Date();

  const carousel = {
    title: title.trim(),
    subtitle: subtitle?.trim() || "",
    link: link?.trim() || "",
    openInNewTab: Boolean(openInNewTab),
    image,
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    updatedAt,
    createdAt,
  };

  try {
    const result = await carouselCollection.insertOne(carousel);
    res.status(201).json({
      success: true,
      carousel: { ...carousel, _id: result.insertedId },
      message: "Carousel slide added successfully",
    });
  } catch (error) {
    console.error("uploadCarousel error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 2. Get all carousels (with optional onlyActive query for customer storefront)
export const getCarousels = async (req, res) => {
  const { onlyActive } = req.query;

  try {
    const query = onlyActive === "true" ? { isActive: { $ne: false } } : {};
    const carousels = await carouselCollection
      .find(query)
      .sort({ order: 1, createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, carousels });
  } catch (error) {
    console.error("getCarousels error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 3. Update a carousel slide
export const updateCarousel = async (req, res) => {
  const { id } = req.params;
  const { title, subtitle, link, openInNewTab, image, order, isActive } = req.body;

  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid carousel ID" });
  }

  try {
    const existing = await carouselCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Carousel not found" });
    }

    // If a new image was uploaded and replaced an old one, clean up the old one from Cloudinary
    if (
      image?.public_id &&
      existing.image?.public_id &&
      image.public_id !== existing.image.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(existing.image.public_id);
      } catch (err) {
        console.error("Cloudinary cleanup error on update:", err);
      }
    }

    const updateFields = {
      ...(title !== undefined && { title: title.trim() }),
      ...(subtitle !== undefined && { subtitle: subtitle.trim() }),
      ...(link !== undefined && { link: link.trim() }),
      ...(openInNewTab !== undefined && { openInNewTab: Boolean(openInNewTab) }),
      ...(image && { image }),
      ...(order !== undefined && { order: Number(order) || 0 }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      updatedAt: new Date(),
    };

    await carouselCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updatedCarousel = await carouselCollection.findOne({ _id: new ObjectId(id) });
    res.status(200).json({
      success: true,
      carousel: updatedCarousel,
      message: "Carousel updated successfully",
    });
  } catch (error) {
    console.error("updateCarousel error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 4. Toggle active status
export const toggleCarouselStatus = async (req, res) => {
  const { id } = req.params;

  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid carousel ID" });
  }

  try {
    const existing = await carouselCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Carousel not found" });
    }

    const newStatus = existing.isActive === undefined ? false : !existing.isActive;

    await carouselCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: newStatus, updatedAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      isActive: newStatus,
      message: `Carousel ${newStatus ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("toggleCarouselStatus error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 5. Delete carousel and cleanup Cloudinary image
export const deleteCarousel = async (req, res) => {
  const { id } = req.params;

  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid carousel ID" });
  }

  try {
    const carousel = await carouselCollection.findOne({ _id: new ObjectId(id) });

    if (!carousel) {
      return res.status(404).json({ success: false, message: "Carousel not found" });
    }

    // Delete image from Cloudinary if public_id exists
    if (carousel?.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(carousel.image.public_id);
      } catch (err) {
        console.error("Cloudinary delete error on carousel remove:", err);
      }
    }

    await carouselCollection.deleteOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: "Carousel deleted successfully",
    });
  } catch (error) {
    console.error("deleteCarousel error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
