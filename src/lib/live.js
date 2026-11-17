import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { pullFacebook } from "./facebook";
import { buildStats } from "./match";
import { pullMediaNet } from "./medianet";
import { normalizeZone } from "./zones";

dayjs.extend(utc);
dayjs.extend(timezone);

const TTL = 3 * 60 * 1000;
let cache = null;
let inflight = null;

export function todayIn(zone) {
  return dayjs().tz(normalizeZone(zone)).format("YYYY-MM-DD");
}

async function pullDay(day) {
  const [spendResult, revenueResult] = await Promise.allSettled([pullFacebook(day, day), pullMediaNet(day, day)]);
  const spendOk = spendResult.status === "fulfilled";
  const revenueOk = revenueResult.status === "fulfilled";
  const spendRows = spendOk ? spendResult.value : [];
  const revenueRows = revenueOk ? revenueResult.value : [];
  const docs = spendOk || revenueOk ? buildStats(spendRows, revenueRows) : [];
  return {
    day,
    at: Date.now(),
    docs: docs.filter((doc) => {
      if (String(doc.day) !== day) return false;
      if (!spendOk && (doc.hour || Number(doc.spend))) return false;
      if (!revenueOk && !doc.hour && !Number(doc.spend)) return false;
      return true;
    }),
    spendOk,
    revenueOk,
    spendError: spendOk ? "" : `Facebook: ${spendResult.reason?.message || "request failed"}. Today's spend is the last saved copy.`,
    revenueError: revenueOk ? "" : `Media.net: ${revenueResult.reason?.message || "request failed"}. Today's revenue is the last saved copy.`,
  };
}

export function loadLiveDay(day, fresh) {
  if (!fresh && cache && cache.day === day && Date.now() - cache.at < TTL) return Promise.resolve(cache);
  if (inflight && inflight.day === day) return inflight.promise;
  const promise = pullDay(day)
    .then((result) => {
      cache = result;
      return result;
    })
    .finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
  inflight = { day, promise };
  return promise;
}

export async function overlayLive(docs, { startDate, endDate, timeZone, fresh, campaignId, adSetId, adId, groupKey }) {
  const today = todayIn(timeZone);
  if (today < startDate || today > endDate) return { docs, live: false, liveError: "" };
  const live = await loadLiveDay(today, fresh);
  const next = docs.filter((doc) => {
    if (String(doc.day) !== today) return true;
    const spendDoc = Boolean(doc.hour) || Number(doc.spend) > 0;
    if (spendDoc) return !live.spendOk;
    return !live.revenueOk;
  });
  for (const doc of live.docs) {
    if (campaignId && doc.campaignId !== campaignId) continue;
    if (adSetId && doc.adSetId !== adSetId) continue;
    if (adId && doc.adId !== adId) continue;
    if (groupKey === "ad" && !doc.adId) continue;
    if (groupKey === "adset" && !doc.adSetId) continue;
    if (groupKey === "hour" && !doc.hour) continue;
    next.push(doc);
  }
  return {
    docs: next,
    live: live.spendOk || live.revenueOk,
    liveError: [live.spendError, live.revenueError].filter(Boolean).join(" "),
  };
}
