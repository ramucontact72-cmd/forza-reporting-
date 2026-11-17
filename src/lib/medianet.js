function reportUrl() {
  return process.env.MEDIANET_REPORT_URL || "https://api-pubconsole.media.net/v2/reports";
}

function yyyymmdd(day) {
  return day.replaceAll("-", "");
}

function money(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

export async function pullMediaNet(startDate, endDate) {
  const email = process.env.MEDIANET_EMAIL;
  const password = process.env.MEDIANET_PASSWORD;
  if (!email || !password) {
    throw new Error("Set MEDIANET_EMAIL and MEDIANET_PASSWORD in .env.local");
  }

  const loginResponse = await fetch("https://api-pubconsole.media.net/v2/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ user_email: email, password }),
  });
  const loginBody = await loginResponse.json();
  const token = loginBody?.data?.token;
  if (!token) {
    throw new Error(loginBody?.message || "Media.net login failed");
  }

  const rows = [];
  let pageNo = 1;
  let total = Infinity;

  while (rows.length < total && pageNo < 40) {
    const response = await fetch(reportUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        token,
      },
      body: JSON.stringify({
        start_date: yyyymmdd(startDate),
        end_date: yyyymmdd(endDate),
        group_by: ["date", "channel", "channel_name2", "channel_name3"],
        pagination: { page_size: 5000, page_no: pageNo },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.message || body?.error || "";
      if (response.status === 429 || /too many/i.test(String(message))) {
        throw new Error("Too Many Attempts");
      }
      throw new Error(message || "Media.net report failed");
    }
    const pageRows = body?.data?.rows || [];
    total = Number(body?.data?.pagination?.total_rows ?? pageRows.length);
    if (pageRows.length === 0) break;

    for (const item of pageRows) {
      const rawDate = String(item.date || "");
      const day = rawDate.slice(0, 10);
      const hour = rawDate.length >= 19 ? rawDate.slice(11, 19) : "";
      rows.push({
        day,
        hour,
        channelName: String(item.channelName ?? item.channel ?? ""),
        channelName2: String(item.channelName2 ?? ""),
        channelName3: String(item.channelName3 ?? ""),
        adtag: String(item.adtag ?? ""),
        revenue: money(item.estimated_revenue),
        revenueImpressions: Number(item.impressions || 0),
        revenueClicks: Number(item.total_clicks || item.ad_clicks || 0),
      });
    }
    pageNo += 1;
  }

  return rows;
}
