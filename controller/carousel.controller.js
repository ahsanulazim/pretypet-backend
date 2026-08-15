import { carouselCollection } from "../collections/collections.js";

export const uploadCarousel = async (req, res) => {
  const { title, link, image } = req.body;
  const updatedAt = new Date();
  const createdAt = new Date();
  const carousel = {
    title,
    link,
    image,
    updatedAt,
    createdAt,
  };

  try {
    await carouselCollection.insertOne(carousel);
    res.status(200).json({ success: true, carousel });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCarousels = async (req, res) => {
  try {
    const carousels = await carouselCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    if (!carousels) {
      return res
        .status(404)
        .json({ success: false, message: "Carousels not found" });
    }

    res.status(200).json({ success: true, carousels });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
