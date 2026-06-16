import client from "../lib/db.js";

export const userCollection = client.db("pretypet").collection("users");
await userCollection.createIndex({ email: 1 }, { unique: true });

export const productCollection = client.db("pretypet").collection("products");
export const storeCollection = client.db("pretypet").collection("store");
export const categoryCollection = client
  .db("pretypet")
  .collection("categories");
await categoryCollection.createIndex({ slug: 1 }, { unique: true });
export const locationCollection = client.db("pretypet").collection("locations");
await locationCollection.createIndex({ slug: 1 }, { unique: true });
