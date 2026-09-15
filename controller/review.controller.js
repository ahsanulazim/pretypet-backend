import { ObjectId } from "mongodb";
import { reviewsCollection } from "../collections/collections.js";

/**
 * 1. Create or update a customer review
 */
export const createReview = async (req, res, next) => {
  try {
    const {
      productId,
      productTitle,
      productThumbnail,
      orderId,
      rating,
      comment,
      petName,
      petType,
      userEmail,
      userName,
    } = req.body;

    if (!productId || !userEmail || !rating) {
      return res.status(400).json({
        success: false,
        message: "Product, user email, and rating (1-5) are required",
      });
    }

    const numericRating = Math.max(1, Math.min(5, Number(rating) || 5));

    const newReview = {
      productId: String(productId),
      productTitle: productTitle || "Pet Product",
      productThumbnail: productThumbnail || "",
      orderId: orderId || null,
      rating: numericRating,
      comment: comment?.trim() || "",
      petName: petName?.trim() || "",
      petType: petType || "",
      userEmail: userEmail.trim().toLowerCase(),
      userName: userName || "Pet Parent",
      updatedAt: new Date(),
    };

    // Upsert: update existing review by this user for this product or insert new
    const filter = {
      productId: String(productId),
      userEmail: userEmail.trim().toLowerCase(),
    };
    if (orderId) filter.orderId = orderId;

    const existing = await reviewsCollection.findOne(filter);

    if (existing) {
      await reviewsCollection.updateOne(
        { _id: existing._id },
        { $set: newReview }
      );
      return res.status(200).json({
        success: true,
        message: "Review updated successfully",
        reviewId: existing._id,
      });
    }

    newReview.createdAt = new Date();
    const result = await reviewsCollection.insertOne(newReview);

    res.status(201).json({
      success: true,
      message: "Review submitted successfully! Thank you for sharing 🐾",
      reviewId: result.insertedId,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    next(error);
  }
};

/**
 * 2. Get reviews by user email
 */
export const getMyReviews = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const reviews = await reviewsCollection
      .find({ userEmail: email.trim().toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      reviews: reviews.map((r) => ({ ...r, _id: r._id.toString() })),
    });
  } catch (error) {
    console.error("Error in getMyReviews:", error);
    next(error);
  }
};

/**
 * 3. Get all reviews for a specific product
 */
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const reviews = await reviewsCollection
      .find({ productId: String(productId) })
      .sort({ createdAt: -1 })
      .toArray();

    const total = reviews.length;
    const averageRating =
      total > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
        : 0;

    res.json({
      success: true,
      total,
      averageRating: Number(averageRating),
      reviews: reviews.map((r) => ({ ...r, _id: r._id.toString() })),
    });
  } catch (error) {
    console.error("Error in getProductReviews:", error);
    next(error);
  }
};

/**
 * 4. Delete customer review
 */
export const deleteReview = async (req, res, next) => {
  try {
    const { id, email } = req.query;
    if (!id || !email || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Valid review ID and email required" });
    }

    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email.trim().toLowerCase(),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Review not found or unauthorized" });
    }

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error in deleteReview:", error);
    next(error);
  }
};
