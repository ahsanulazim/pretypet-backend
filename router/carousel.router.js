import { Router } from "express";
import {
  getCarousels,
  uploadCarousel,
} from "../controller/carousel.controller.js";

const carouselRouter = Router();

carouselRouter.post("/upload", uploadCarousel);
carouselRouter.get("/get-all", getCarousels);

export default carouselRouter;
