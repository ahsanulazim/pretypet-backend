import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import categoryRouter from "./router/category.router.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to Pretypet Backend");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//routes
app.use("/api/v1/categories", categoryRouter);
