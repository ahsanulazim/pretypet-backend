import { ObjectId } from "mongodb";
import {
  productCollection,
  categoryCollection,
  brandCollection,
} from "../collections/collections.js";
import cjApi from "../services/cjApiService.js";
import { convertToSlug } from "../utils/convertToSlug.js";

/**
 * 1. Get CJ "My Products" (shortlist) with live MongoDB import status
 */
export const getCjImportList = async (req, res, next) => {
  try {
    const pageNum = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const keyword = req.query.keyword?.trim() || "";

    const cjResponse = await cjApi.get("/product/myProduct/query", {
      params: {
        pageNum,
        pageSize,
        keyword,
      },
    });

    if (cjResponse.data.code !== 200) {
      throw new Error(cjResponse.data.message || "Failed to fetch from CJ");
    }

    const cjData = cjResponse.data.data;
    const content = Array.isArray(cjData?.content) ? cjData.content : [];

    // Extract all CJ product IDs on the current page
    const pids = content
      .map((item) => String(item.productId || item.pid))
      .filter(Boolean);

    // Cross-reference MongoDB product collection
    let importedMap = new Map();
    if (pids.length > 0) {
      const existingInDb = await productCollection
        .find(
          { cjProductId: { $in: pids } },
          {
            projection: {
              _id: 1,
              cjProductId: 1,
              title: 1,
              slug: 1,
              price: 1,
              status: 1,
              createdAt: 1,
            },
          },
        )
        .toArray();

      existingInDb.forEach((doc) => {
        importedMap.set(String(doc.cjProductId), doc);
      });
    }

    // Enrich CJ list with import status
    const enrichedContent = content.map((item) => {
      const pid = String(item.productId || item.pid);
      const storeItem = importedMap.get(pid);
      return {
        ...item,
        isImported: Boolean(storeItem),
        storeProduct: storeItem || null,
      };
    });

    res.json({
      success: true,
      data: {
        ...cjData,
        content: enrichedContent,
      },
    });
  } catch (error) {
    console.error("Error in getCjImportList:", error);
    next(error);
  }
};

/**
 * 2. Get CJ product details formatted specifically for the Import Customizer
 */
export const getCjProductForImport = async (req, res, next) => {
  try {
    const { pid } = req.query;
    if (!pid) {
      return res
        .status(400)
        .json({ success: false, message: "CJ Product ID (pid) is required" });
    }

    const cjResponse = await cjApi.get("/product/query", {
      params: { pid },
    });

    if (cjResponse.data.code !== 200) {
      throw new Error(
        cjResponse.data.message || "Failed to fetch product from CJ",
      );
    }

    const raw = cjResponse.data.data;
    console.log(raw);

    // Check if this product is already in MongoDB
    const existingInDb = await productCollection.findOne({
      cjProductId: String(pid),
    });

    // Parse image sets safely
    let images = [];
    if (Array.isArray(raw.productImageSet)) {
      images = raw.productImageSet;
    } else if (typeof raw.productImage === "string") {
      try {
        const parsed = JSON.parse(raw.productImage);
        images = Array.isArray(parsed) ? parsed : [raw.productImage];
      } catch {
        images = [raw.productImage];
      }
    }
    if (raw.bigImage && !images.includes(raw.bigImage)) {
      images.unshift(raw.bigImage);
    }

    // Normalize variants with cost price and clean labels
    const rawVariants = Array.isArray(raw.variants) ? raw.variants : [];

    // Query real live warehouse stock from CJ Open API (/product/stock/queryByVid)
    let liveWarehouseStock = 0;
    const primaryVid = rawVariants[0]?.vid;
    if (primaryVid) {
      try {
        const stockRes = await cjApi.get("/product/stock/queryByVid", {
          params: { vid: primaryVid },
        });
        const stockItems = stockRes.data?.data || [];
        liveWarehouseStock = stockItems.reduce(
          (sum, it) =>
            sum +
            (it.totalInventoryNum ||
              it.storageNum ||
              it.factoryInventoryNum ||
              0),
          0,
        );
      } catch (err) {
        console.warn(
          "Could not fetch real-time warehouse stock from CJ:",
          err.message,
        );
      }
    }

    const formattedVariants = rawVariants.map((v, index) => {
      const costPrice = parseFloat(v.variantSellPrice) || parseFloat(raw.sellPrice) || 0;
      const suggestedPrice = parseFloat(v.variantSugSellPrice) || 0;
      // Default suggested selling price: CJ suggested price, or 2x markup, or minimum +$10
      const defaultRetailPrice =
        suggestedPrice > costPrice
          ? suggestedPrice
          : costPrice > 0
            ? Number((costPrice * 2).toFixed(2))
            : 10;

      // Real variant stock from CJ variant data or live warehouse query
      const variantStockNum = parseInt(
        v.inventoryNum || v.storageNum || v.inventory || 0,
      );
      const actualStock =
        variantStockNum > 0
          ? variantStockNum
          : liveWarehouseStock > 0
            ? liveWarehouseStock
            : 0;

      return {
        vid: String(v.vid || `VAR-${index}`),
        cjVid: String(v.vid || ""),
        variantSku: v.variantSku || "",
        variantKey: v.variantKey || v.variantNameEn || `Variant ${index + 1}`,
        variantImage: v.variantImage || raw.bigImage || images[0] || "",
        costPrice: costPrice,
        suggestedPrice: suggestedPrice,
        price: defaultRetailPrice, // editable in UI
        stock: actualStock,
        weight: parseFloat(v.variantWeight || raw.packingWeight || raw.productWeight || 0),
        dimensions: {
          length: parseFloat(v.variantLength) || 0,
          width: parseFloat(v.variantWidth) || 0,
          height: parseFloat(v.variantHeight) || 0,
        },
        isActive: true, // user can uncheck to omit variant
      };
    });

    // Weight calculation and range detection
    const rawWeightField =
      raw.packingWeight ||
      raw.packWeight ||
      raw.productWeight ||
      raw.weight ||
      "";

    const variantWeights = formattedVariants
      .map((v) => parseFloat(v.weight) || 0)
      .filter((w) => w > 0);

    let computedWeightDisplay = "";
    if (typeof rawWeightField === "string" && rawWeightField.includes("-")) {
      computedWeightDisplay = rawWeightField.trim();
    } else if (variantWeights.length > 0) {
      const minW = Math.min(...variantWeights);
      const maxW = Math.max(...variantWeights);
      computedWeightDisplay = minW === maxW ? `${minW}` : `${minW} - ${maxW}`;
    } else {
      computedWeightDisplay = String(parseFloat(rawWeightField) || 0);
    }

    // Also fetch store categories for easy frontend selection
    const categories = await categoryCollection
      .find({}, { projection: { _id: 1, name: 1, slug: 1 } })
      .toArray();

    const brands = await brandCollection
      .find({}, { projection: { _id: 1, name: 1, value: 1 } })
      .toArray();

    res.json({
      success: true,
      product: {
        pid: String(raw.pid),
        cjProductSku: raw.productSku || "",
        originalTitle: raw.productNameEn || "",
        title: raw.productNameEn || "",
        thumbnail: raw.bigImage || images[0] || "",
        images: images,
        description: raw.description || "",
        categoryName: raw.categoryName || raw.entryNameEn || "",
        entryNameEn: raw.entryNameEn || "",
        suggestedSellPrice: raw.suggestSellPrice || "",
        weight: parseFloat(rawWeightField) || (variantWeights[0] || 0),
        weightDisplay: computedWeightDisplay,
        packingWeight: String(rawWeightField),
        warehouseInventory: liveWarehouseStock,
        productKeyEn: raw.productKeyEn || "",
        variants: formattedVariants,
      },
      isImported: Boolean(existingInDb),
      existingProduct: existingInDb || null,
      storeOptions: {
        categories,
        brands,
      },
    });
  } catch (error) {
    console.error("Error in getCjProductForImport:", error);
    next(error);
  }
};

/**
 * 3. Import & Save customized CJ product to MongoDB productCollection
 */
export const importProductToStore = async (req, res, next) => {
  try {
    const {
      title,
      category,
      brand,
      noBrand,
      cjProductId,
      cjProductSku,
      thumbnail,
      images,
      description,
      variants,
      basePrice,
      baseStock,
      costPrice,
      weight,
      dimensions,
      status = "active",
      tags = [],
      productKeyEn = "",
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Product title is required" });
    }

    if (!cjProductId) {
      return res
        .status(400)
        .json({ success: false, message: "CJ Product ID is required" });
    }

    if (!category) {
      return res
        .status(400)
        .json({ success: false, message: "Category is required" });
    }

    // Check if already imported
    const existing = await productCollection.findOne({
      cjProductId: String(cjProductId),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "This product is already imported in your store. You can edit it from the main products dashboard.",
        existingId: existing._id,
      });
    }

    // Generate unique slug
    let baseSlug = convertToSlug(title.trim());
    let slug = baseSlug;
    let count = 0;
    while (await productCollection.findOne({ slug })) {
      count++;
      slug = `${baseSlug}-${count}`;
    }

    // Format active variants
    const activeVariants = Array.isArray(variants)
      ? variants.filter((v) => v.isActive !== false)
      : [];

    const hasVariations = activeVariants.length > 0;

    // Dictionaries for auto-detecting attribute names
    const SIZES = new Set([
      "XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL",
      "XXL", "XXXL", "1X", "2X", "3X", "SMALL", "MEDIUM", "LARGE", "MINI"
    ]);
    const MATERIALS = new Set([
      "cotton", "polyester", "wool", "silk", "leather", "nylon", "linen",
      "velvet", "fleece", "denim", "silicone", "plastic", "metal", "wood",
      "mesh", "rubber", "plush"
    ]);

    let dynamicAttributes = [];
    if (hasVariations) {
      if (typeof productKeyEn === "string" && productKeyEn.includes("-")) {
        dynamicAttributes = productKeyEn.split("-").map((name, i) => ({
          name: name.trim(),
          slug: convertToSlug(name.trim()),
          partIndex: i,
        }));
      } else {
        const keys = activeVariants
          .map((v) => (v.variantKey || "").trim())
          .filter(Boolean);
        const splitKeys = keys.map((k) => k.split("-").map((s) => s.trim()));
        const numParts = splitKeys[0]?.length || 1;
        const isAllSame = splitKeys.every(
          (p) => p.length === numParts && p.length > 1
        );

        if (isAllSame) {
          for (let i = 0; i < numParts; i++) {
            const vals = [...new Set(splitKeys.map((p) => p[i]))];
            const isAllSizes = vals.every(
              (v) =>
                SIZES.has(v.toUpperCase()) ||
                /^\d+(\.\d+)?(cm|mm|m|in|inch|g|kg|oz|lb|ml|l)$/i.test(v)
            );
            const isMaterial = vals.some((v) =>
              MATERIALS.has(v.toLowerCase())
            );

            let name = `Option ${i + 1}`;
            let slug = `option_${i + 1}`;
            if (isAllSizes) {
              name = "Size";
              slug = "size";
            } else if (isMaterial) {
              name = "Material";
              slug = "material";
            } else if (i === 0 && numParts === 2) {
              name = "Color";
              slug = "color";
            }
            dynamicAttributes.push({ name, slug, partIndex: i });
          }
        } else {
          dynamicAttributes = [{ name: "Variant", slug: "variant", partIndex: 0 }];
        }
      }
    }

    // Structure variant documents for database
    const mappedVariations = activeVariants.map((v, idx) => {
      const vObj = {
        vid: v.vid || v.cjVid || `vid-${idx}`,
        cjVid: v.cjVid || v.vid || "",
        cjSku: v.variantSku || "",
        variantKey: v.variantKey || "",
        price: parseFloat(v.price) || parseFloat(basePrice) || 0,
        costPrice: parseFloat(v.costPrice) || 0,
        stock: parseInt(v.stock) || 100,
        weight: parseFloat(v.weight) || 0,
        thumbnail:
          typeof v.variantImage === "string"
            ? { url: v.variantImage }
            : v.thumbnail || null,
        images: v.variantImage ? [{ url: v.variantImage }] : [],
      };

      if (dynamicAttributes.length > 1 && v.variantKey && v.variantKey.includes("-")) {
        const parts = v.variantKey.split("-").map((s) => s.trim());
        dynamicAttributes.forEach((attr) => {
          if (parts[attr.partIndex] !== undefined) {
            vObj[attr.slug] = parts[attr.partIndex];
          }
        });
      }

      return vObj;
    });

    // Calculate overall price and stock
    const computedPrice = hasVariations
      ? mappedVariations[0]?.price || parseFloat(basePrice) || 0
      : parseFloat(basePrice) || 0;

    const computedStock = hasVariations
      ? mappedVariations.reduce((sum, v) => sum + (v.stock || 0), 0)
      : parseInt(baseStock) || 100;

    // Format gallery images
    const formattedImages = Array.isArray(images)
      ? images.map((img) => (typeof img === "string" ? { url: img } : img))
      : [];

    const formattedThumbnail =
      typeof thumbnail === "string"
        ? { url: thumbnail }
        : thumbnail || formattedImages[0] || null;

    const productDoc = {
      title: title.trim(),
      slug,
      category:
        typeof category === "object"
          ? category.slug || category.name
          : category,
      brand: noBrand ? null : brand || null,
      noBrand: Boolean(noBrand),

      // Essential Dropshipping metadata
      isDropshipped: true,
      supplier: "cjdropshipping",
      cjProductId: String(cjProductId),
      cjProductSku: cjProductSku || "",
      costPrice:
        parseFloat(costPrice) ||
        (hasVariations ? mappedVariations[0]?.costPrice : 0),

      // Pricing & Inventory
      price: computedPrice,
      basePrice: computedPrice,
      baseStock: computedStock,
      baseDiscount: 0,
      stock: computedStock,

      // Variants
      hasVariations,
      variations: mappedVariations,
      attributes: hasVariations ? dynamicAttributes : [],
      productKeyEn: productKeyEn || "",

      // Media & Details
      thumbnail: formattedThumbnail,
      images: formattedImages,
      description: description || "",
      weight: parseFloat(weight) || 0,
      dimensions: dimensions || { length: 0, width: 0, height: 0 },
      tags: Array.isArray(tags) ? tags : [],
      status: status || "active", // active or draft
      freeShipping: false,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await productCollection.insertOne(productDoc);

    res.status(201).json({
      success: true,
      message: "Product imported and published to your store successfully!",
      product: {
        ...productDoc,
        _id: insertResult.insertedId,
      },
    });
  } catch (error) {
    console.error("Error in importProductToStore:", error);
    next(error);
  }
};

/**
 * 4. Real-time sync of a product's price and stock from CJ
 */
export const syncCjProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid Product ID is required" });
    }

    const product = await productCollection.findOne({ _id: new ObjectId(id) });
    if (!product || !product.cjProductId) {
      return res
        .status(404)
        .json({ success: false, message: "Dropshipped product not found" });
    }

    // Query latest details from CJ
    const cjResponse = await cjApi.get("/product/query", {
      params: { pid: product.cjProductId },
    });

    if (cjResponse.data.code !== 200) {
      throw new Error(
        cjResponse.data.message || "Failed to fetch updated data from CJ",
      );
    }

    const cjData = cjResponse.data.data;
    const cjVariants = Array.isArray(cjData?.variants) ? cjData.variants : [];

    // Query live warehouse inventory from CJ stock endpoint
    let liveStock = 0;
    const primaryVid = cjVariants[0]?.vid || product.variations?.[0]?.cjVid;
    if (primaryVid) {
      try {
        const sRes = await cjApi.get("/product/stock/queryByVid", {
          params: { vid: primaryVid },
        });
        const sItems = sRes.data?.data || [];
        liveStock = sItems.reduce(
          (sum, it) =>
            sum +
            (it.totalInventoryNum ||
              it.storageNum ||
              it.factoryInventoryNum ||
              0),
          0,
        );
      } catch (err) {
        console.warn("Could not fetch live stock in sync:", err.message);
      }
    }

    // Map updated variant stocks and costs
    let updatedVariations = product.variations || [];
    if (product.hasVariations && updatedVariations.length > 0) {
      updatedVariations = updatedVariations.map((v) => {
        const matchingCjVar = cjVariants.find(
          (cv) => String(cv.vid) === String(v.cjVid),
        );
        if (matchingCjVar) {
          const varStock = parseInt(
            matchingCjVar.inventoryNum || matchingCjVar.storageNum || 0,
          );
          const actualStock =
            varStock > 0 ? varStock : liveStock > 0 ? liveStock : v.stock;

          return {
            ...v,
            costPrice:
              parseFloat(matchingCjVar.variantSellPrice) || v.costPrice,
            stock: actualStock,
          };
        }
        return v;
      });
    }

    await productCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          variations: updatedVariations,
          updatedAt: new Date(),
          lastCjSyncAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Product stock & cost synced with CJ successfully",
    });
  } catch (error) {
    console.error("Error in syncCjProduct:", error);
    next(error);
  }
};

/**
 * 5. Update existing product in MongoDB from unified customizer
 */
export const updateStoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid Product ID is required" });
    }

    const existingProduct = await productCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!existingProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const {
      title,
      category,
      brand,
      noBrand,
      price,
      basePrice,
      baseStock,
      status,
      description,
      thumbnail,
      images,
      variations,
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Product title is required" });
    }

    if (!category) {
      return res
        .status(400)
        .json({ success: false, message: "Category is required" });
    }

    const hasVariations = Array.isArray(variations) && variations.length > 0;

    // Process updated variations, preserving CJ mapping if present
    let updatedVariations = [];
    if (hasVariations) {
      updatedVariations = variations.map((v, idx) => {
        const existingVar = Array.isArray(existingProduct.variations)
          ? existingProduct.variations.find(
              (ev) => String(ev.vid || ev.cjVid) === String(v.vid || v.cjVid),
            )
          : null;

        return {
          vid: v.vid || existingVar?.vid || `vid-${idx}`,
          cjVid: v.cjVid || existingVar?.cjVid || "",
          cjSku: v.variantSku || v.cjSku || existingVar?.cjSku || "",
          variantKey:
            v.variantKey || existingVar?.variantKey || `Variant ${idx + 1}`,
          price: parseFloat(v.price) || parseFloat(basePrice) || 0,
          costPrice: parseFloat(v.costPrice) || existingVar?.costPrice || 0,
          stock: parseInt(v.stock) || existingVar?.stock || 100,
          weight: parseFloat(v.weight) !== undefined ? parseFloat(v.weight) || 0 : existingVar?.weight || 0,
          thumbnail:
            typeof v.variantImage === "string"
              ? { url: v.variantImage }
              : v.thumbnail || null,
          images: v.variantImage ? [{ url: v.variantImage }] : v.images || [],
          isActive: v.isActive !== false,
        };
      });
    }

    // Compute updated price and stock
    const activeVars = updatedVariations.filter((v) => v.isActive !== false);
    const computedPrice =
      activeVars.length > 0
        ? activeVars[0]?.price ||
          parseFloat(price) ||
          parseFloat(basePrice) ||
          0
        : parseFloat(price) || parseFloat(basePrice) || 0;

    const computedStock =
      activeVars.length > 0
        ? activeVars.reduce((sum, v) => sum + (v.stock || 0), 0)
        : parseInt(baseStock) || existingProduct.stock || 0;

    const formattedThumbnail =
      typeof thumbnail === "string"
        ? { url: thumbnail }
        : thumbnail || existingProduct.thumbnail;

    const formattedImages = Array.isArray(images)
      ? images.map((img) => (typeof img === "string" ? { url: img } : img))
      : existingProduct.images || [];

    const updateFields = {
      title: title.trim(),
      category:
        typeof category === "object"
          ? category.slug || category.name
          : category,
      brand: noBrand ? null : brand || null,
      noBrand: Boolean(noBrand),
      status: status || existingProduct.status || "active",
      description:
        description !== undefined ? description : existingProduct.description,
      price: computedPrice,
      basePrice: computedPrice,
      stock: computedStock,
      baseStock: computedStock,
      thumbnail: formattedThumbnail,
      images: formattedImages,
      updatedAt: new Date(),
    };

    if (hasVariations) {
      updateFields.hasVariations = true;
      updateFields.variations = updatedVariations;
    }

    await productCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields },
    );

    const updatedDoc = await productCollection.findOne({
      _id: new ObjectId(id),
    });

    res.json({
      success: true,
      message: "Product updated successfully!",
      product: updatedDoc,
    });
  } catch (error) {
    console.error("Error in updateStoreProduct:", error);
    next(error);
  }
};

/**
 * 6. Calculate real-time CJ shipping options and rates for checkout
 */
export const calculateCjShipping = async (req, res, next) => {
  try {
    const { countryCode = "US", province = "", city = "", zip = "", items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart items are required to calculate shipping",
      });
    }

    // Resolve CJ VIDs from items or DB
    const cjProducts = [];
    for (const item of items) {
      let vid = item.vid || item.cjVid;
      const qty = Math.max(1, parseInt(item.quantity) || 1);

      if (!vid && item.productId) {
        try {
          const query = ObjectId.isValid(item.productId)
            ? { _id: new ObjectId(item.productId) }
            : { cjProductId: String(item.productId) };
          const prod = await productCollection.findOne(query);
          if (prod && Array.isArray(prod.variations) && prod.variations.length > 0) {
            vid = prod.variations[0].cjVid || prod.variations[0].vid;
          }
        } catch (dbErr) {
          console.warn("Could not lookup product for shipping vid:", dbErr.message);
        }
      }

      if (vid) {
        cjProducts.push({
          vid: String(vid),
          quantity: qty,
        });
      }
    }

    // Fallback if no dropshipped CJ items
    if (cjProducts.length === 0) {
      const standardOption = {
        id: "standard-store-shipping",
        logisticName: "Standard Store Shipping",
        logisticPrice: 4.99,
        logisticAging: "3-7 days",
        isRecommended: true,
      };
      return res.json({
        success: true,
        isDropshipped: false,
        options: [standardOption],
        recommendedOption: standardOption,
        cheapestOption: standardOption,
      });
    }

    const payload = {
      startCountryCode: "CN",
      endCountryCode: (countryCode || "US").trim().toUpperCase(),
      products: cjProducts,
    };

    if (zip && typeof zip === "string" && zip.trim()) {
      payload.zip = zip.trim();
    }
    if (province && typeof province === "string" && province.trim()) {
      payload.province = province.trim();
    }
    if (city && typeof city === "string" && city.trim()) {
      payload.city = city.trim();
    }

    const cjResponse = await cjApi.post("/logistic/freightCalculate", payload);

    if (cjResponse.data.code !== 200 && !cjResponse.data.data) {
      console.warn("CJ freight calculation warning:", cjResponse.data);
      // Fallback in case of CJ API issues
      const fallback = {
        id: "standard-flat",
        logisticName: "Standard Shipping (Flat Rate)",
        logisticPrice: 5.99,
        logisticAging: "7-15 days",
        isRecommended: true,
      };
      return res.json({
        success: true,
        isFallback: true,
        options: [fallback],
        recommendedOption: fallback,
        cheapestOption: fallback,
        notice: cjResponse.data.message || "Calculated using standard flat rate",
      });
    }

    const rawOptions = Array.isArray(cjResponse.data.data) ? cjResponse.data.data : [];

    // Filter valid shipping lines (no error and valid price)
    const validOptions = rawOptions
      .filter((opt) => !opt.error && (opt.totalPostageFee > 0 || opt.logisticPrice > 0))
      .map((opt) => {
        const price = Number((opt.totalPostageFee ?? opt.logisticPrice ?? 0).toFixed(2));
        const aging = opt.logisticAging ? `${opt.logisticAging} days` : "7-15 days";
        const isRec = Array.isArray(opt.recommendLogisticsTypeList) && opt.recommendLogisticsTypeList.length > 0;

        return {
          id: opt.logisticName,
          name: opt.logisticName,
          logisticName: opt.logisticName,
          price: price,
          logisticPrice: price,
          aging: aging,
          logisticAging: aging,
          isRecommended: isRec,
          timePrioritySort: opt.timePrioritySort ?? 999,
          compositeRecommendSort: opt.compositeRecommendSort ?? 999,
        };
      });

    if (validOptions.length === 0) {
      const fallback = {
        id: "standard-flat",
        logisticName: "Standard Shipping",
        logisticPrice: 5.99,
        logisticAging: "7-15 days",
        isRecommended: true,
      };
      return res.json({
        success: true,
        isFallback: true,
        options: [fallback],
        recommendedOption: fallback,
        cheapestOption: fallback,
      });
    }

    // Sort: lowest price first
    const sortedByPrice = [...validOptions].sort((a, b) => a.logisticPrice - b.logisticPrice);

    // Identify recommended option (composite lowest sort or cheapest)
    const recommended =
      validOptions.find((o) => o.isRecommended) || sortedByPrice[0];

    // Pick top unique best options (up to 5 to avoid overwhelming the customer)
    // Always include cheapest, fastest, and recommended
    const curatedOptions = [];
    const seen = new Set();

    const addOption = (opt) => {
      if (opt && !seen.has(opt.id)) {
        seen.add(opt.id);
        curatedOptions.push(opt);
      }
    };

    addOption(recommended);
    addOption(sortedByPrice[0]); // cheapest
    // add other top 3 cheapest
    sortedByPrice.slice(0, 4).forEach(addOption);

    res.json({
      success: true,
      options: curatedOptions,
      allOptionsCount: validOptions.length,
      recommendedOption: recommended,
      cheapestOption: sortedByPrice[0],
    });
  } catch (error) {
    console.error("Error in calculateCjShipping:", error?.response?.data || error.message);
    // Safe fallback so checkout is never blocked
    const fallback = {
      id: "standard-flat",
      logisticName: "Standard Delivery",
      logisticPrice: 5.99,
      logisticAging: "7-14 days",
      isRecommended: true,
    };
    res.json({
      success: true,
      isFallback: true,
      options: [fallback],
      recommendedOption: fallback,
      cheapestOption: fallback,
    });
  }
};

