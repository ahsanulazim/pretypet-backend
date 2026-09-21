import { ObjectId } from "mongodb";
import { productCollection } from "../collections/collections.js";
import cjApi from "./cjApiService.js";

// Keep in-memory status of sync runs
let lastSyncStatus = {
  isRunning: false,
  lastRunAt: null,
  totalChecked: 0,
  updatedCount: 0,
  outOfStockCount: 0,
  priceChangedCount: 0,
  errorsCount: 0,
  durationMs: 0,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run full inventory and cost price sync across all CJ dropshipped products
 */
export const runFullCjInventorySync = async () => {
  if (lastSyncStatus.isRunning) {
    return {
      success: false,
      message: "A CJ sync is already in progress. Please wait for it to complete.",
      status: lastSyncStatus,
    };
  }

  const startTime = Date.now();
  lastSyncStatus.isRunning = true;

  try {
    // Find all active dropshipped products with a CJ Product ID
    const dropshippedProducts = await productCollection
      .find({
        $or: [{ isDropshipped: true }, { supplier: "cjdropshipping" }],
        cjProductId: { $exists: true, $ne: "" },
      })
      .toArray();

    let updatedCount = 0;
    let outOfStockCount = 0;
    let priceChangedCount = 0;
    let errorsCount = 0;

    console.log(
      `[CJ Sync] Starting sync for ${dropshippedProducts.length} dropshipped products...`
    );

    for (let i = 0; i < dropshippedProducts.length; i++) {
      const product = dropshippedProducts[i];
      const pid = String(product.cjProductId);

      try {
        // Query latest details from CJ
        const cjResponse = await cjApi.get("/product/query", {
          params: { pid },
        });

        if (cjResponse.data.code !== 200) {
          console.warn(`[CJ Sync] Failed to fetch pid ${pid}:`, cjResponse.data.message);
          errorsCount++;
          continue;
        }

        const cjData = cjResponse.data.data;
        const cjVariants = Array.isArray(cjData?.variants) ? cjData.variants : [];

        // Query warehouse stock for primary variant
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
              0
            );
          } catch (stockErr) {
            console.warn(`[CJ Sync] Warehouse stock check failed for ${primaryVid}:`, stockErr.message);
          }
        }

        let updatedVariations = product.variations || [];
        let hasPriceChange = false;

        if (product.hasVariations && updatedVariations.length > 0) {
          updatedVariations = updatedVariations.map((v) => {
            const matchedCj = cjVariants.find(
              (cv) => String(cv.vid) === String(v.cjVid || v.vid)
            );

            if (matchedCj) {
              const varStock = parseInt(
                matchedCj.inventoryNum || matchedCj.storageNum || 0
              );
              const actualStock =
                varStock > 0 ? varStock : liveStock > 0 ? liveStock : 0;
              const newCost =
                parseFloat(matchedCj.variantSellPrice) || v.costPrice || 0;

              if (newCost > 0 && Math.abs(newCost - (v.costPrice || 0)) > 0.05) {
                hasPriceChange = true;
              }

              return {
                ...v,
                costPrice: newCost,
                stock: actualStock,
              };
            }
            return v;
          });
        }

        // Compute overall stock
        const computedStock =
          updatedVariations.length > 0
            ? updatedVariations.reduce((sum, v) => sum + (v.stock || 0), 0)
            : liveStock;

        if (computedStock === 0) {
          outOfStockCount++;
        }
        if (hasPriceChange) {
          priceChangedCount++;
        }

        const updatePayload = {
          stock: computedStock,
          baseStock: computedStock,
          variations: updatedVariations,
          lastCjSyncAt: new Date(),
          updatedAt: new Date(),
        };

        if (computedStock === 0) {
          updatePayload.inStock = false;
        } else {
          updatePayload.inStock = true;
        }

        await productCollection.updateOne(
          { _id: product._id },
          { $set: updatePayload }
        );

        updatedCount++;

        // Rate-limit pause: 250ms between requests
        await delay(250);
      } catch (prodErr) {
        console.error(`[CJ Sync] Error syncing product ${product._id}:`, prodErr.message);
        errorsCount++;
      }
    }

    const durationMs = Date.now() - startTime;
    lastSyncStatus = {
      isRunning: false,
      lastRunAt: new Date(),
      totalChecked: dropshippedProducts.length,
      updatedCount,
      outOfStockCount,
      priceChangedCount,
      errorsCount,
      durationMs,
    };

    console.log(
      `[CJ Sync] Completed in ${(durationMs / 1000).toFixed(1)}s. Checked: ${dropshippedProducts.length}, Updated: ${updatedCount}, Out of Stock: ${outOfStockCount}, Price Changes: ${priceChangedCount}`
    );

    return {
      success: true,
      message: `Full CJ inventory sync completed in ${(durationMs / 1000).toFixed(1)}s`,
      status: lastSyncStatus,
    };
  } catch (error) {
    lastSyncStatus.isRunning = false;
    console.error("[CJ Sync] Critical error in full sync:", error);
    return {
      success: false,
      message: error.message || "Failed to execute CJ inventory sync",
      status: lastSyncStatus,
    };
  }
};

/**
 * Get current sync status
 */
export const getCjSyncStatus = () => {
  return lastSyncStatus;
};
