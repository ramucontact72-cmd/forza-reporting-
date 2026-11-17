import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fb_mnet";

export async function getDb() {
  if (!globalThis._fbMnetClient) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    globalThis._fbMnetClient = client;
  }
  const db = globalThis._fbMnetClient.db();
  if (!globalThis._fbMnetIndexed) {
    await db.collection("stats").createIndex({ day: 1, campaignId: 1, adSetId: 1, adId: 1 });
    await db.collection("stats").createIndex({ key: 1 }, { unique: true });
    globalThis._fbMnetIndexed = true;
  }
  return db;
}
