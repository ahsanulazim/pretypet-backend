import { v2 as cloudinary } from "cloudinary";

/**
 * ফাইল বাফারকে ক্লাউডিনারিতে আপলোড করার হেল্পার
 * @param {Buffer} fileBuffer
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "product_images", resource_type: "auto" },
      (error, uploadResult) => {
        if (error) return reject(error);
        resolve({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      },
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * ক্লাউডিনারি থেকে publicId দিয়ে ইমেজ ডিলিট করার হেল্পার
 * @param {string} publicId
 * @returns {Promise<any>}
 */
export const deleteFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};
