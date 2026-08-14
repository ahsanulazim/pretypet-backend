import cloudinary from "../lib/cloudinary.js";

// Helper function to upload a single buffer to Cloudinary using stream
const uploadSingleToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "products" },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );
    uploadStream.end(file.buffer);
  });
};

export const uploadSingleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const result = await uploadSingleToCloudinary(req.file);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({ error: "Failed to upload image" });
  }
};

export const uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadPromises = req.files.map((file) =>
      uploadSingleToCloudinary(file),
    );
    const results = await Promise.all(uploadPromises);

    return res.status(200).json(results);
  } catch (error) {
    console.error("Cloudinary multi-upload error:", error);
    return res.status(500).json({ error: "Failed to upload images" });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ error: "public_id is required" });
    }
    const result = await cloudinary.uploader.destroy(public_id);
    return res
      .status(200)
      .json({ message: "Image deleted successfully", result });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return res.status(500).json({ error: "Failed to delete image" });
  }
};

//text editor image upload
export const textEditorSingleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const result = await uploadSingleToCloudinary(req.file);
    return res.status(200).json({
      success: 1,
      file: {
        url: result.url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({ error: "Failed to upload image" });
  }
};

//text editor image upload externel
export const textEditorSingleImageExternal = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Url is required" });
    }
    const result = await cloudinary.uploader.upload(url, {
      folder: "products",
    });
    return res.status(200).json({
      success: 1,
      file: {
        url: result.url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({ error: "Failed to upload image" });
  }
};
