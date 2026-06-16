import {
  productCollection,
  storeCollection,
} from "../collections/collections.js";
import cjApi from "../services/cjApiService.js";

export const cjGetProducts = async (req, res, next) => {
  try {
    const response = await cjApi.post("/product/list", {
      pageNum: 1,
      pageSize: 20,
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching CJ products:", error);
    next(error);
  }
};

//cj product search
export const cjSearchProducts = async (req, res, next) => {
  try {
    const { keyWord, page = 1 } = req.query;

    const size = 24;

    const response = await cjApi.get("/product/listV2", {
      params: {
        keyWord,
        page,
        size,
      },
    });
    if (response.data.code !== 200) throw new Error(response.data.message);

    res.json({ success: true, products: response.data.data });
  } catch (error) {
    console.error("CJ API Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
};

//cj product details
export const getCjProductDetails = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const response = await cjApi.get(`/product/query?pid=${productId}`);

    if (response.data.code !== 200) throw new Error(response.data.message);

    res.json({ success: true, product: response.data.data });
  } catch (error) {
    next(error);
  }
};

// ➕ Add Product to Store
export const addProductToStore = async (req, res, next) => {
  try {
    const { productId } = req.body;

    const response = await cjApi.get(`/product/query?pid=${productId}`);

    if (response.data.code !== 200) throw new Error(response.data.message);

    const product = response.data.data;
    // Sync with CJ "Add to My Product"
    const cjResponse = await cjApi.post("/product/addToMyProduct", {
      productId,
    });
    if (cjResponse.data.code !== 200) throw new Error(cjResponse.data.message);

    await storeCollection.insertOne({
      ...product,
      createdAt: new Date(),
    });

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// ❌ Delete Product from Store
export const deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const result = await storeCollection.deleteOne({ productId });

    if (result.deletedCount === 0) throw new Error("Product not found");

    // Sync with CJ "Delete Product"
    const cjResponse = await cjApi.post("/myCJProduct/delete", { productId });
    if (cjResponse.data.code !== 200) throw new Error(cjResponse.data.message);

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllStoreProducts = async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = 10;

    const products = await storeCollection
      .find()
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    const totalProducts = await storeCollection.countDocuments();
    const totalPages = Math.ceil(totalProducts / limitNum);

    res.json({ success: true, products, totalProducts, totalPages });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const products = await productCollection.find().toArray();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
