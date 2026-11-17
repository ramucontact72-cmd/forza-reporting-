import { NextResponse } from "next/server";
import { readStats } from "@/lib/sync";

export const maxDuration = 120;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await readStats({
      startDate: searchParams.get("startDate") || today,
      endDate: searchParams.get("endDate") || today,
      group: searchParams.get("group") || "campaign",
      campaignId: searchParams.get("campaignId") || "",
      adSetId: searchParams.get("adSetId") || "",
      adId: searchParams.get("adId") || "",
      timeZone: searchParams.get("timeZone") || "",
      accountId: searchParams.get("accountId") || "",
      fresh: searchParams.get("fresh") === "1",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = String(error.message || "").includes("ECONNREFUSED")
      ? "MongoDB is not running on 127.0.0.1:27017"
      : error.message;
    return NextResponse.json({ rows: [], error: message }, { status: 500 });
  }
}
