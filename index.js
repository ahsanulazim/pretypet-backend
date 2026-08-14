import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./router/user.router.js";
import productRouter from "./router/product.router.js";
import categoryRouter from "./router/category.router.js";
import brandRouter from "./router/brand.router.js";
import locationRouter from "./router/location.router.js";
import attributeRouter from "./router/attribute.router.js";
import variantRouter from "./router/variant.router.js";
import cloudinaryRouter from "./router/cloudinary.router.js";
import { cjErrorHandler } from "./middleware/cjErrorHandler.js";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://pretypet.com"],
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to Pretypet Backend");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//multer upload limiter
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Maximum 10 images are allowed" });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal Server Error" });
});

//routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/brands", brandRouter);
app.use("/api/v1/locations", locationRouter);
app.use("/api/v1/attributes", attributeRouter);
app.use("/api/v1/variants", variantRouter);
app.use("/api/v1/upload", cloudinaryRouter);

app.use(cjErrorHandler);
