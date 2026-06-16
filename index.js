import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./router/user.router.js";
import productRouter from "./router/product.router.js";
import categoryRouter from "./router/category.router.js";
import locationRouter from "./router/location.router.js";
import attributeRouter from "./router/attribute.router.js";
import { cjErrorHandler } from "./middleware/cjErrorHandler.js";

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

//routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/locations", locationRouter);
app.use("/api/v1/attributes", attributeRouter);

app.use(cjErrorHandler);
