import { Router } from "express";
import { upload } from "../services/multer.js";
import {
  deleteImage,
  textEditorSingleImage,
  textEditorSingleImageExternal,
  uploadMultipleImages,
  uploadSingleImage,
} from "../controller/cloudinary.controller.js";

const cloudinaryRouter = Router();

cloudinaryRouter.post("/single", upload.single("image"), uploadSingleImage);
cloudinaryRouter.post(
  "/multiple",
  upload.array("images", 10),
  uploadMultipleImages,
);
cloudinaryRouter.post("/delete", deleteImage);
cloudinaryRouter.post(
  "/editorUpload",
  upload.single("image"),
  textEditorSingleImage,
);

cloudinaryRouter.post("/editorUploadExternal", textEditorSingleImageExternal);

export default cloudinaryRouter;
