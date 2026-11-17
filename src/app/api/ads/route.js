import { NextResponse } from "next/server";
import { pullCampaignAds } from "@/lib/facebook";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  if (!DAY.test(startDate) || !DAY.test(endDate) || startDate > endDate) {
    return NextResponse.json({ rows: [], error: "Pick a valid date range" }, { status: 400 });
  }
  try {
    const rows = await pullCampaignAds({
      campaignId: searchParams.get("campaignId") || "",
      adSetId: searchParams.get("adSetId") || "",
      startDate,
      endDate,
    });
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ rows: [], error: error.message }, { status: 500 });
  }
}
