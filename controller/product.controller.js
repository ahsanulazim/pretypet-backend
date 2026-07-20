import {
  productCollection,
  storeCollection,
} from "../collections/collections.js";
import cjApi from "../services/cjApiService.js";
import { uploadToCloudinary } from "../utils/cloudinaryHelper.js";
import { convertToSlug } from "../utils/convertToSlug.js";

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

export const getListedProducts = async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page) || 1;
    const cjResponse = await cjApi.get("/product/myProduct/query", {
      params: {
        pageNum,
        pageSize: 10,
        keyword: "",
      },
    });
    if (cjResponse.data.code !== 200) throw new Error(cjResponse.data.message);

    res.json({ success: true, data: cjResponse.data.data });
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

export const getNewArriavals = async (req, res) => {
  try {
    const newArriavals = await storeCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.status(200).json(newArriavals);
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getProductByPid = async (req, res) => {
  const { pid } = req.query;

  try {
    const product = await storeCollection.findOne({ pid });
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ product, message: "Product Found!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ==========================================
// 1. CREATE PRODUCT (Fully Dynamic Image Handling)
// ==========================================
export const createProduct = async (req, res) => {
  try {
    const productsCollection = await getProductCollection();

    const { title, price, sku, compareAtPrice, stock } = req.body;
    const description = req.body.description
      ? JSON.parse(req.body.description)
      : {};
    const attributes = req.body.attributes
      ? JSON.parse(req.body.attributes)
      : [];
    const hasVariations =
      req.body.hasVariations === "true" || req.body.hasVariations === true;
    let variations = req.body.variations ? JSON.parse(req.body.variations) : [];

    if (!title || !price) {
      return res
        .status(400)
        .json({ success: false, message: "Title and Price are required." });
    }

    // SEO Slug Generation...
    let slug = convertToSlug(title);
    const slugRegex = new RegExp(`^${slug}(-[0-9]+)?$`, "i");
    const existingSlugsCount = await productsCollection.countDocuments({
      slug: slugRegex,
    });
    if (existingSlugsCount > 0) slug = `${slug}-${existingSlugsCount}`;

    // --- ১০০% ডায়নামিক ইমেজ হ্যান্ডলিং লজিক ---
    let baseImagesUrls = [];
    const files = req.files || []; // upload.any() এর কারণে এটা একটা ফ্ল্যাট অ্যারে

    // ১. মেইন প্রোডাক্টের ইমেজ ফিল্টার ও আপলোড
    const mainImageFiles = files.filter((file) => file.fieldname === "images");
    if (mainImageFiles.length > 0) {
      const uploadPromises = mainImageFiles.map((file) =>
        uploadToCloudinary(file.buffer),
      );
      baseImagesUrls = await Promise.all(uploadPromises);
    }

    // ২. ডাইনামিক ভেরিয়েশনের ইমেজ ফিল্টার ও আপলোড
    if (hasVariations && variations.length > 0) {
      for (let i = 0; i < variations.length; i++) {
        // ফ্রন্টএন্ড থেকে পাঠানো ইন্ডেক্স অনুযায়ী ফাইল ফিল্টার করা (e.g., variation_images_0, variation_images_1...)
        const varImageFiles = files.filter(
          (file) => file.fieldname === `variation_images_${i}`,
        );

        if (varImageFiles.length > 0) {
          const varUploadPromises = varImageFiles.map((file) =>
            uploadToCloudinary(file.buffer),
          );
          variations[i].images = await Promise.all(varUploadPromises);
        } else {
          variations[i].images = variations[i].images || [];
        }
      }
    }

    const newProduct = {
      title,
      slug,
      description,
      sku: sku || null,
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
      stock: hasVariations ? 0 : Number(stock) || 0,
      images: baseImagesUrls,
      attributes,
      hasVariations,
      variations: hasVariations
        ? variations.map((v) => ({
            sku: v.sku || null,
            price: Number(v.price),
            stock: Number(v.stock) || 0,
            images: v.images,
            combination: v.combination || [],
          }))
        : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await productsCollection.insertOne(newProduct);
    return res
      .status(201)
      .json({ success: true, data: { _id: result.insertedId, ...newProduct } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 2. READ PRODUCTS (Pagination, Search & Get Single by Slug/ID)
// ==========================================
export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    let query = {};
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const [products, count] = await Promise.all([
      productCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      productCollection.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
