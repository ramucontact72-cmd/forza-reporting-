const GRAPH = process.env.FACEBOOK_GRAPH_VERSION || "v21.0";

function accountIds() {
  return (process.env.FACEBOOK_AD_ACCOUNT_IDS || "")
    .split(",")
    .map((id) => id.trim().replace(/^act_/, ""))
    .filter(Boolean);
}

export async function pullFacebook(startDate, endDate) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const ids = accountIds();
  if (!token || ids.length === 0) {
    throw new Error("Set FACEBOOK_ACCESS_TOKEN and FACEBOOK_AD_ACCOUNT_IDS in .env.local");
  }

  const rows = [];
  for (const accountId of ids) {
    const timeRange = encodeURIComponent(`{'since':'${startDate}','until':'${endDate}'}`);
    let url =
      `https://graph.facebook.com/${GRAPH}/act_${accountId}/insights` +
      `?level=ad` +
      `&fields=account_id,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend` +
      `&time_increment=1&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&limit=100` +
      `&time_range=${timeRange}&access_token=${token}`;

    for (let page = 0; url && page < 50; page++) {
      const response = await fetch(url);
      const body = await response.json();
      if (body.error) {
        throw new Error(body.error.message || "Facebook insights failed");
      }
      for (const item of body.data || []) {
        const hourText = String(item.hourly_stats_aggregated_by_advertiser_time_zone || "");
        rows.push({
          day: item.date_start,
          hour: hourText.split(" - ")[0] || "",
          accountId: item.account_id || accountId,
          campaignId: String(item.campaign_id || ""),
          campaignName: item.campaign_name || "",
          adSetId: String(item.adset_id || ""),
          adSetName: item.adset_name || "",
          adId: String(item.ad_id || ""),
          adName: item.ad_name || "",
          spend: Number(item.spend || 0),
          spendImpressions: Number(item.impressions || 0),
          spendClicks: Number(item.clicks || 0),
        });
      }
      url = body.paging?.next || null;
    }
  }
  return rows;
}

async function graphPages(url, pageLimit) {
  const rows = [];
  for (let page = 0; url && page < pageLimit; page++) {
    const response = await fetch(url);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || "Facebook request failed");
    rows.push(...(body.data || []));
    url = body.paging?.next || null;
  }
  return rows;
}

let accountCache = { at: 0, zones: new Map(), accountByCampaign: new Map(), accounts: [] };

export async function accountDirectory() {
  if (accountCache.accounts.length && Date.now() - accountCache.at < 30 * 60 * 1000) return accountCache;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const ids = accountIds();
  const zones = new Map();
  const accountByCampaign = new Map();
  const accounts = [];
  if (!token || ids.length === 0) return { zones, accountByCampaign, accounts };
  for (const accountId of ids) {
    const infoResponse = await fetch(
      `https://graph.facebook.com/${GRAPH}/act_${accountId}?fields=name,timezone_name&access_token=${token}`
    );
    const info = await infoResponse.json();
    if (info.error) throw new Error(info.error.message || "Could not read the account time zone");
    const zone = info.timezone_name || "UTC";
    accounts.push({ id: accountId, name: info.name || accountId, zone });
    const campaigns = await graphPages(
      `https://graph.facebook.com/${GRAPH}/act_${accountId}/campaigns?fields=id&limit=500&access_token=${token}`,
      20
    );
    for (const campaign of campaigns) {
      zones.set(String(campaign.id), zone);
      accountByCampaign.set(String(campaign.id), accountId);
    }
  }
  accountCache = { at: Date.now(), zones, accountByCampaign, accounts };
  return accountCache;
}

export function cachedDirectory() {
  if (!accountCache.accounts.length || Date.now() - accountCache.at >= 30 * 60 * 1000) return null;
  return accountCache;
}

export async function campaignTimeZones() {
  return (await accountDirectory()).zones;
}

function httpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
}

function creativeFields(creative) {
  const story = creative?.object_story_spec || {};
  const video = story.video_data || {};
  const link = story.link_data || {};
  const imageUrl =
    httpUrl(creative?.image_url) ||
    httpUrl(creative?.thumbnail_url) ||
    httpUrl(video.image_url) ||
    httpUrl(link.image_url) ||
    httpUrl(link.picture);
  const videoId = String(video.video_id || creative?.video_id || "");
  return {
    imageUrl,
    isVideo: Boolean(videoId) || String(creative?.object_type || "").toUpperCase() === "VIDEO" || Boolean(story.video_data),
    headline: link.name || video.title || creative?.title || "",
    primaryText: link.message || video.message || creative?.body || "",
  };
}

function leadCount(actions) {
  const match = (actions || []).find((action) =>
    ["offsite_conversion.fb_pixel_lead", "offsite_conversion.fb_pixel_purchase", "offsite_conversion.fb_pixel_add_to_cart", "lead"].includes(
      action.action_type
    )
  );
  return match ? Number(match.value || 0) : 0;
}

export async function pullCampaignAds({ campaignId, adSetId, startDate, endDate }) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) throw new Error("Set FACEBOOK_ACCESS_TOKEN in .env.local");
  if (!/^\d+$/.test(campaignId || "")) throw new Error("This row has no Facebook campaign id");

  const fields = "id,name,status,adset_id,creative{thumbnail_url,image_url,title,body,object_type,video_id,object_story_spec}";
  let adsUrl =
    `https://graph.facebook.com/${GRAPH}/${campaignId}/ads` +
    `?fields=${encodeURIComponent(fields)}&limit=50&access_token=${token}`;
  const timeRange = encodeURIComponent(`{'since':'${startDate}','until':'${endDate}'}`);
  let insightsUrl =
    `https://graph.facebook.com/${GRAPH}/${campaignId}/insights` +
    `?level=ad&fields=ad_id,spend,impressions,clicks,cpc,ctr,actions` +
    `&time_range=${timeRange}&limit=100&access_token=${token}`;
  if (adSetId) {
    const filtering = encodeURIComponent(JSON.stringify([{ field: "adset.id", operator: "EQUAL", value: adSetId }]));
    adsUrl += `&filtering=${filtering}`;
    insightsUrl += `&filtering=${filtering}`;
  }

  const [ads, insights] = await Promise.all([graphPages(adsUrl, 8), graphPages(insightsUrl, 8)]);
  const byAd = new Map(insights.map((row) => [String(row.ad_id), row]));

  return ads.map((ad) => {
    const stats = byAd.get(String(ad.id)) || {};
    const spend = Number(stats.spend || 0);
    const leads = leadCount(stats.actions);
    const creative = creativeFields(ad.creative);
    return {
      key: String(ad.id),
      id: String(ad.id),
      name: ad.name || String(ad.id),
      status: ad.status || "",
      spend: Math.round(spend * 100) / 100,
      impressions: Number(stats.impressions || 0),
      clicks: Number(stats.clicks || 0),
      leads,
      cpl: leads ? Math.round((spend / leads) * 100) / 100 : 0,
      cpc: Number(stats.cpc || 0),
      ctr: Number(stats.ctr || 0),
      ...creative,
    };
  });
}

function dollars(cents) {
  const value = Number(cents || 0);
  if (!value) return 0;
  return Math.round(value) / 100;
}

function requireToken(id) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) throw new Error("Set FACEBOOK_ACCESS_TOKEN in .env.local");
  if (!/^\d+$/.test(id || "")) throw new Error("This row has no Facebook id");
  return token;
}

export async function readFacebookEntity(id) {
  const token = requireToken(id);
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH}/${id}?fields=status,daily_budget,lifetime_budget,budget_remaining&access_token=${token}`
  );
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "Facebook request failed");
  const daily = dollars(body.daily_budget);
  const lifetime = dollars(body.lifetime_budget);
  const budgetType = daily > 0 ? "Daily" : lifetime > 0 ? "Lifetime" : "";
  return {
    id,
    status: body.status || "",
    budgetType,
    budget: budgetType === "Daily" ? daily : budgetType === "Lifetime" ? lifetime : null,
    remaining: body.budget_remaining ? dollars(body.budget_remaining) : null,
  };
}

export async function updateFacebookEntity({ id, status, budget, budgetType }) {
  const token = requireToken(id);
  const params = new URLSearchParams({ access_token: token });
  if (status) {
    if (status !== "ACTIVE" && status !== "PAUSED") throw new Error("Status must be start or stop");
    params.set("status", status);
  }
  if (budget != null && budget !== "") {
    const cents = Math.round(Number(budget) * 100);
    if (!Number.isFinite(cents) || cents <= 0) throw new Error("Enter a budget");
    const field = String(budgetType || "daily").toLowerCase() === "lifetime" ? "lifetime_budget" : "daily_budget";
    params.set(field, String(cents));
  }
  const response = await fetch(`https://graph.facebook.com/${GRAPH}/${id}`, { method: "POST", body: params });
  const body = await response.json();
  if (body.error) throw new Error(body.error.error_user_msg || body.error.message || "Facebook update failed");
  return { ok: true };
}
