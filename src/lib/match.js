function numeric(value) {
  return /^\d+$/.test(value || "");
}

function indexFacebook(spendRows) {
  const byAdSet = new Map();
  const byAd = new Map();
  const byCampaign = new Map();

  for (const row of spendRows) {
    if (row.adSetId && !byAdSet.has(row.adSetId)) byAdSet.set(row.adSetId, row);
    if (row.adId && !byAd.has(row.adId)) byAd.set(row.adId, row);
    if (row.campaignId && !byCampaign.has(row.campaignId)) byCampaign.set(row.campaignId, row);
  }
  return { byAdSet, byAd, byCampaign };
}

function attachRevenue(item, index) {
  const adSetKey = numeric(item.channelName3) ? item.channelName3 : item.channelName2;
  const fromAdSet = index.byAdSet.get(adSetKey);
  if (fromAdSet) {
    return {
      campaignId: fromAdSet.campaignId,
      campaignName: fromAdSet.campaignName,
      adSetId: fromAdSet.adSetId,
      adSetName: fromAdSet.adSetName,
      adId: "",
      adName: "",
    };
  }

  const fromAd = index.byAd.get(item.channelName2) || index.byAd.get(item.channelName3);
  if (fromAd) {
    return {
      campaignId: fromAd.campaignId,
      campaignName: fromAd.campaignName,
      adSetId: fromAd.adSetId,
      adSetName: fromAd.adSetName,
      adId: fromAd.adId,
      adName: fromAd.adName,
    };
  }

  const fromCampaign = index.byCampaign.get(item.channelName) || index.byCampaign.get(item.channelName2);
  if (fromCampaign) {
    return {
      campaignId: fromCampaign.campaignId,
      campaignName: fromCampaign.campaignName,
      adSetId: numeric(item.channelName2) ? item.channelName2 : "",
      adSetName: "",
      adId: "",
      adName: "",
    };
  }

  return {
    campaignId: item.channelName2 || item.channelName || "unmatched",
    campaignName: "Unmatched",
    adSetId: numeric(item.channelName3) ? item.channelName3 : "",
    adSetName: "",
    adId: "",
    adName: "",
  };
}

export function buildStats(spendRows, revenueRows) {
  const index = indexFacebook(spendRows);
  const docs = [];

  for (const row of spendRows) {
    docs.push({
      key: ["spend", row.day, row.hour, row.campaignId, row.adSetId, row.adId].join(":"),
      day: row.day,
      hour: row.hour,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      adSetId: row.adSetId,
      adSetName: row.adSetName,
      adId: row.adId,
      adName: row.adName,
      spend: row.spend,
      spendImpressions: row.spendImpressions,
      spendClicks: row.spendClicks,
      revenue: 0,
      revenueImpressions: 0,
      revenueClicks: 0,
    });
  }

  for (const row of revenueRows) {
    const ids = attachRevenue(row, index);
    docs.push({
      key: ["revenue", row.day, row.hour, ids.campaignId, ids.adSetId, ids.adId, row.channelName, row.channelName2, row.channelName3, row.adtag].join(":"),
      day: row.day,
      hour: row.hour,
      ...ids,
      spend: 0,
      spendImpressions: 0,
      spendClicks: 0,
      revenue: row.revenue,
      revenueImpressions: row.revenueImpressions,
      revenueClicks: row.revenueClicks,
    });
  }

  return docs;
}
