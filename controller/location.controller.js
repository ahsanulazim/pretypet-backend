import { locationCollection } from "../collections/collections.js";

export const getAllLocations = async (req, res) => {
  try {
    const locations = await locationCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json({ success: true, locations });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch locations" });
  }
};

export const getStates = async (req, res) => {
  try {
    const { slug } = req.query;
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = 10;

    const country = await locationCollection.findOne({ slug });

    const states = country?.states?.slice(
      (pageNum - 1) * limitNum,
      pageNum * limitNum,
    );

    const totalStates = country?.states?.length || 0;
    const totalPages = Math.ceil(totalStates / limitNum);

    if (!country) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }

    res.status(200).json({ success: true, states, totalStates, totalPages });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch states" });
  }
};
