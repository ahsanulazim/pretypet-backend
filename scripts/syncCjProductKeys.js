import { productCollection } from "../collections/collections.js";
import cjApi from "../services/cjApiService.js";
import { convertToSlug } from "../utils/convertToSlug.js";

async function run() {
  const list = await productCollection.find({ isDropshipped: true }).toArray();
  console.log(`Found ${list.length} dropshipped products.`);

  for (const p of list) {
    if (!p.cjProductId) continue;
    try {
      const res = await cjApi.get("/product/query", {
        params: { pid: p.cjProductId },
      });
      const raw = res.data?.data;
      const productKeyEn = raw?.productKeyEn || "";
      console.log(`Product: "${p.title}" -> CJ productKeyEn: "${productKeyEn}"`);

      let newAttributes = [];
      if (productKeyEn && productKeyEn.includes("-")) {
        newAttributes = productKeyEn.split("-").map((k, i) => ({
          name: k.trim(),
          slug: convertToSlug(k.trim()),
          partIndex: i,
        }));
      } else if (productKeyEn && productKeyEn.trim()) {
        newAttributes = [
          {
            name: productKeyEn.trim(),
            slug: convertToSlug(productKeyEn.trim()),
            partIndex: 0,
          },
        ];
      } else {
        newAttributes = [{ name: "Variant", slug: "variant", partIndex: 0 }];
      }

      // Update variations with individual decomposed attributes
      const updatedVariations = (p.variations || []).map((v) => {
        const vKey = v.variantKey || "";
        const parts = vKey.split("-").map((s) => s.trim());
        const ext = { ...v };
        newAttributes.forEach((attr, idx) => {
          if (parts[idx] !== undefined) {
            ext[attr.slug] = parts[idx];
          }
        });
        return ext;
      });

      await productCollection.updateOne(
        { _id: p._id },
        {
          $set: {
            productKeyEn,
            attributes: newAttributes,
            variations: updatedVariations,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`Updated attributes for "${p.title}":`, JSON.stringify(newAttributes));
    } catch (err) {
      console.error(`Error updating "${p.title}":`, err.message);
    }
  }

  process.exit(0);
}

run();
