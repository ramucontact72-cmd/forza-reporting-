import { accountDirectory, cachedDirectory } from "./facebook";
import { getDb } from "./mongo";

const KNOWN = {
  "1440796994659728": { name: "DSH_Media.Net", zone: "America/New_York" },
  "1633496278434584": { name: "Media.Net_FV_1", zone: "UTC" },
};

function accountIds() {
  return (process.env.FACEBOOK_AD_ACCOUNT_IDS || "")
    .split(",")
    .map((id) => id.trim().replace(/^act_/, ""))
    .filter(Boolean);
}

export function fallbackAccounts() {
  return accountIds().map((id) => ({
    id,
    name: KNOWN[id]?.name || id,
    zone: KNOWN[id]?.zone || "UTC",
  }));
}

export async function readDirectory() {
  const db = await getDb();
  let doc = await db.collection("directory").findOne({ _id: "facebook" });
  if (!doc?.accounts?.length) {
    const cached = cachedDirectory();
    if (cached) {
      doc = {
        accounts: cached.accounts,
        zones: Object.fromEntries(cached.zones),
        accountByCampaign: Object.fromEntries(cached.accountByCampaign),
      };
      await db.collection("directory").updateOne({ _id: "facebook" }, { $set: { ...doc, updatedAt: new Date() } }, { upsert: true });
    }
  }
  return {
    accounts: doc?.accounts?.length ? doc.accounts : fallbackAccounts(),
    zones: new Map(Object.entries(doc?.zones || {})),
    accountByCampaign: new Map(Object.entries(doc?.accountByCampaign || {})),
  };
}

export async function writeDirectory() {
  const directory = await accountDirectory();
  const db = await getDb();
  await db.collection("directory").updateOne(
    { _id: "facebook" },
    {
      $set: {
        accounts: directory.accounts,
        zones: Object.fromEntries(directory.zones),
        accountByCampaign: Object.fromEntries(directory.accountByCampaign),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  return directory;
}
