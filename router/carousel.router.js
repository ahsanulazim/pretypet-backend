import { Router } from "express";
import {
  deleteCarousel,
  getCarousels,
  toggleCarouselStatus,
  updateCarousel,
  uploadCarousel,
} from "../controller/carousel.controller.js";

const carouselRouter = Router();

carouselRouter.post("/upload", uploadCarousel);
carouselRouter.get("/get-all", getCarousels);
carouselRouter.put("/update/:id", updateCarousel);
carouselRouter.patch("/toggle-status/:id", toggleCarouselStatus);
carouselRouter.delete("/delete/:id", deleteCarousel);

export default carouselRouter;
