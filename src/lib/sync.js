import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { accountDirectory, pullFacebook } from "./facebook";
import { overlayLive } from "./live";
import { buildStats } from "./match";
import { pullMediaNet } from "./medianet";
import { getDb } from "./mongo";
import { normalizeZone } from "./zones";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function assertRange(startDate, endDate) {
  if (!DAY.test(startDate || "") || !DAY.test(endDate || "")) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (startDate > endDate) {
    throw new Error("Start date is after end date");
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = (end - start) / 86400000;
  if (days > 31) {
    throw new Error("Pick 31 days or fewer");
  }
}

export async function syncRange(startDate, endDate) {
  assertRange(startDate, endDate);
  const [spendRows, revenueRows] = await Promise.all([
    pullFacebook(startDate, endDate),
    pullMediaNet(startDate, endDate),
  ]);
  const docs = buildStats(spendRows, revenueRows).map((doc) => ({
    ...doc,
    updatedAt: new Date(),
  }));

  const db = await getDb();
  const stats = db.collection("stats");
  await stats.deleteMany({ day: { $gte: startDate, $lte: endDate } });
  if (docs.length > 0) {
    await stats.insertMany(docs, { ordered: false });
  }

  return {
    spendRows: spendRows.length,
    revenueRows: revenueRows.length,
    saved: docs.length,
  };
}

const GROUPS = new Set(["campaign", "adset", "ad", "day", "hour"]);

function padDay(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shiftClock(day, hour, fromZone, toZone) {
  const clock = String(hour || "").slice(0, 5);
  if (!fromZone || fromZone === toZone) return { day, hour: clock };
  const next = dayjs.tz(`${day} ${clock}`, "YYYY-MM-DD HH:mm", fromZone).tz(toZone);
  if (!next.isValid()) return { day, hour: clock };
  return { day: next.format("YYYY-MM-DD"), hour: next.format("HH:mm") };
}

export async function readStats({ startDate, endDate, group, campaignId, adSetId, adId, timeZone, accountId, fresh }) {
  assertRange(startDate, endDate);
  const groupKey = GROUPS.has(group) ? group : "campaign";
  const zone = normalizeZone(timeZone);
  const match = { day: { $gte: padDay(startDate, -1), $lte: padDay(endDate, 1) } };
  if (campaignId) match.campaignId = campaignId;
  if (adSetId) match.adSetId = adSetId;
  if (adId) match.adId = adId;
  if (groupKey === "ad") match.adId = adId || { $nin: ["", null] };
  if (groupKey === "adset") match.adSetId = adSetId || { $nin: ["", null] };
  if (groupKey === "hour") match.hour = { $nin: ["", null] };

  let zones = new Map();
  let accountByCampaign = new Map();
  try {
    const directory = await accountDirectory();
    zones = directory.zones;
    accountByCampaign = directory.accountByCampaign;
  } catch {
    zones = new Map();
    accountByCampaign = new Map();
  }

  const db = await getDb();
  const docs = await db
    .collection("stats")
    .find(match)
    .project({
      day: 1,
      hour: 1,
      campaignId: 1,
      campaignName: 1,
      adSetId: 1,
      adSetName: 1,
      adId: 1,
      adName: 1,
      spend: 1,
      revenue: 1,
      spendImpressions: 1,
      spendClicks: 1,
      revenueImpressions: 1,
      revenueClicks: 1,
    })
    .toArray();

  const live = await overlayLive(docs, {
    startDate,
    endDate,
    timeZone: zone,
    fresh,
    campaignId,
    adSetId,
    adId,
    groupKey,
  });
  const source = accountId
    ? live.docs.filter((doc) => accountByCampaign.get(String(doc.campaignId || "")) === accountId)
    : live.docs;

  const grouped = new Map();
  for (const doc of source) {
    let day = String(doc.day || "");
    let hour = String(doc.hour || "");
    if (hour) {
      const shifted = shiftClock(day, hour, zones.get(String(doc.campaignId || "")), zone);
      day = shifted.day;
      hour = shifted.hour;
    }
    if (day < startDate || day > endDate) continue;
    if (groupKey === "hour" && !hour) continue;

    let id = day;
    let key = day;
    let name = day;
    if (groupKey === "campaign") {
      id = doc.campaignId || "";
      key = id;
      name = doc.campaignName || id;
    } else if (groupKey === "adset") {
      id = doc.adSetId || "";
      key = `${doc.campaignId || ""}:${id}`;
      name = doc.adSetName || id;
    } else if (groupKey === "ad") {
      id = doc.adId || "";
      key = `${doc.campaignId || ""}:${doc.adSetId || ""}:${id}`;
      name = doc.adName || id;
    } else if (groupKey === "hour") {
      id = hour;
      key = hour;
      name = hour;
    }

    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        key,
        id,
        name,
        campaignId: doc.campaignId || "",
        campaignName: doc.campaignName || "",
        adSetId: doc.adSetId || "",
        adSetName: doc.adSetName || "",
        adId: doc.adId || "",
        adName: doc.adName || "",
        spend: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        revenueImpressions: 0,
        revenueClicks: 0,
      };
      grouped.set(key, bucket);
    }
    if (!bucket.name && name) bucket.name = name;
    bucket.spend += Number(doc.spend || 0);
    bucket.revenue += Number(doc.revenue || 0);
    bucket.impressions += Number(doc.spendImpressions || 0);
    bucket.clicks += Number(doc.spendClicks || 0);
    bucket.leads += Number(doc.revenueClicks || 0);
    bucket.revenueImpressions += Number(doc.revenueImpressions || 0);
    bucket.revenueClicks += Number(doc.revenueClicks || 0);
  }

  const rows = [...grouped.values()].map((row) => {
    const spend = round(row.spend);
    const revenue = round(row.revenue);
    return {
      ...row,
      spend,
      revenue,
      profit: round(revenue - spend),
      roi: percent(revenue - spend, spend),
      roas: divide(revenue, spend),
      cpc: divide(spend, row.clicks),
      cpl: divide(spend, row.leads),
      rpl: divide(revenue, row.leads),
      rpc: divide(revenue, row.revenueClicks),
      ctr: percent(row.clicks, row.impressions),
      cvr: percent(row.leads, row.clicks),
      rcvr: percent(row.revenueClicks, row.revenueImpressions),
    };
  });
  rows.sort((a, b) => {
    if (groupKey === "hour" || groupKey === "day") return String(a.name).localeCompare(String(b.name));
    return b.spend - a.spend || b.revenue - a.revenue;
  });
  return { rows: rows.slice(0, 500), live: live.live, liveError: live.liveError };
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function divide(numerator, denominator) {
  if (!denominator) return 0;
  return round(numerator / denominator);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return round((numerator / denominator) * 100);
}
