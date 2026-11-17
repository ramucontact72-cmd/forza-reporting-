import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

function reportUrl() {
  const configured = process.env.MEDIANET_REPORT_URL || "";
  if (!configured || configured.endsWith("/v2/reports")) {
    return "https://api-pubconsole.media.net/v2/reports/hourly-channel-wise";
  }
  return configured;
}

function yyyymmdd(day) {
  return day.replaceAll("-", "");
}

function clockOf(rawDate) {
  const raw = String(rawDate || "").trim();
  const zone = process.env.MEDIANET_TIMEZONE || "UTC";
  const parsed = dayjs.tz(raw, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss"], zone);
  if (!parsed.isValid()) return { day: raw.slice(0, 10), hour: "", clockZone: "" };
  const utcTime = parsed.tz("UTC");
  return { day: utcTime.format("YYYY-MM-DD"), hour: utcTime.format("HH:mm"), clockZone: "UTC" };
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
        pagination: { page_size: 5000, page_no: pageNo },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = body?.message || body?.error || "";
      const detail = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (response.status === 429 || /too many/i.test(detail)) {
        throw new Error("Too Many Attempts");
      }
      throw new Error(detail || `Media.net report failed (${response.status})`);
    }
    const pageRows = body?.data?.rows || [];
    total = Number(body?.data?.pagination?.total_rows ?? pageRows.length);
    if (pageRows.length === 0) break;

    for (const item of pageRows) {
      const clock = clockOf(item.date);
      rows.push({
        day: clock.day,
        hour: clock.hour,
        clockZone: clock.clockZone,
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
