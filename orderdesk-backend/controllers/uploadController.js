import cloudinary from "../config/cloudinary.js";

export const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  return Boolean(
    cloudName &&
      cloudName !== "your_cloud_name" &&
      apiKey &&
      apiKey !== "your_api_key" &&
      apiSecret &&
      apiSecret !== "your_api_secret"
  );
};

function getSafeErrorMessage(error) {
  return [process.env.CLOUDINARY_API_SECRET, process.env.CLOUDINARY_API_KEY]
    .filter(Boolean)
    .reduce(
      (message, secret) => message.split(secret).join("[REDACTED]"),
      String(error?.message || "Unknown Cloudinary error")
    );
}

export const uploadProductImage = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "Image upload service is not configured. Please set Cloudinary credentials in orderdesk-backend/.env.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image.",
      });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "orderdesk/products",
          resource_type: "image",
        },
        (error, uploadedImage) => {
          if (error) return reject(error);
          resolve(uploadedImage);
        }
      );

      stream.end(req.file.buffer);
    });

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      data: {
        imageUrl: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error("Cloudinary image upload failed:", {
      name: error?.name || "Error",
      message: getSafeErrorMessage(error),
      httpCode: error?.http_code,
    });

    return res.status(500).json({
      success: false,
      message:
        error?.http_code === 401
          ? "Image upload service rejected its credentials. Please contact an administrator."
          : "Image upload failed. Please try again.",
    });
  }
};