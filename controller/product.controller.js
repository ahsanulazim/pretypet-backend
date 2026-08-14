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
    const { pid } = req.query;
    const response = await cjApi.get("/product/query", {
      params: { pid },
    });

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
    const {
      title,
      category,
      brand,
      noBrand,
      hasVariations,
      attributes,
      vitalInformations,
      baseStock,
      basePrice,
      baseDiscount,
      variations,
      thumbnail,
      images,
      tags,
      description,
      weight,
      dimensions,
      freeShipping,
    } = req.body;

    // 1. Basic Validations
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!category || typeof category !== "string" || category.trim() === "") {
      return res.status(400).json({ success: false, message: "Category is required" });
    }
    if (!noBrand && (!brand || typeof brand !== "string" || brand.trim() === "")) {
      return res.status(400).json({ success: false, message: "Brand is required unless noBrand is enabled" });
    }
    if (thumbnail === undefined || thumbnail === null) {
      return res.status(400).json({ success: false, message: "Product Thumbnail is required" });
    }

    // 2. Generate Unique Slug
    let slug = convertToSlug(title);
    let isUnique = false;
    let count = 0;
    let tempSlug = slug;
    
    while (!isUnique) {
      const existingProduct = await productCollection.findOne({ slug: tempSlug });
      if (!existingProduct) {
        isUnique = true;
        slug = tempSlug;
      } else {
        count++;
        tempSlug = `${slug}-${count}`;
      }
    }

    // 3. Prepare Product Document
    const productDoc = {
      title: title.trim(),
      slug,
      category: category.trim(),
      brand: noBrand ? null : (brand ? brand.trim() : null),
      noBrand: !!noBrand,
      hasVariations: !!hasVariations,
      vitalInformations: Array.isArray(vitalInformations) ? vitalInformations : null,
      thumbnail, // Expects { url, public_id } object
      images: Array.isArray(images) ? images : [], // Expects array of { url, public_id } objects
      description: typeof description === "string" ? description.trim() : "",
      weight: weight ? parseFloat(weight) : 0,
      dimensions: {
        length: dimensions?.length ? parseFloat(dimensions.length) : 0,
        width: dimensions?.width ? parseFloat(dimensions.width) : 0,
        height: dimensions?.height ? parseFloat(dimensions.height) : 0,
      },
      freeShipping: !!freeShipping,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 4. Product Type Specific Handling (Single vs Variable)
    if (!productDoc.hasVariations) {
      // Single Product Structure
      const price = parseFloat(basePrice);
      if (isNaN(price) || price < 1) {
        return res.status(400).json({ success: false, message: "Base price is required and must be at least 1 for single products" });
      }

      productDoc.basePrice = price;
      productDoc.baseDiscount = baseDiscount ? parseFloat(baseDiscount) : 0;
      productDoc.baseStock = baseStock ? parseInt(baseStock) : 0;
      productDoc.attributes = [];
      productDoc.variations = [];
    } else {
      // Variable Product Structure
      if (!Array.isArray(attributes) || attributes.length === 0) {
        return res.status(400).json({ success: false, message: "Attributes array is required for variable products" });
      }
      if (!Array.isArray(variations) || variations.length === 0) {
        return res.status(400).json({ success: false, message: "Variations array is required and cannot be empty for variable products" });
      }

      // Validate each variation
      for (const variant of variations) {
        const vPrice = parseFloat(variant.price);
        if (isNaN(vPrice) || vPrice < 1) {
          return res.status(400).json({ success: false, message: "Price is required and must be at least 1 for all variations" });
        }
        variant.price = vPrice;
        variant.discount = variant.discount ? parseFloat(variant.discount) : 0;
        variant.stock = variant.stock ? parseInt(variant.stock) : 0;
        if (!variant.thumbnail) {
          return res.status(400).json({ success: false, message: "Thumbnail is required for all variations" });
        }
      }

      productDoc.attributes = attributes;
      productDoc.variations = variations;
      productDoc.basePrice = null;
      productDoc.baseDiscount = null;
      productDoc.baseStock = null;
    }

    // 5. Insert into MongoDB
    const result = await productCollection.insertOne(productDoc);
    
    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: result.insertedId,
      slug: productDoc.slug,
    });
  } catch (error) {
    console.error("Error in createProduct:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
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
