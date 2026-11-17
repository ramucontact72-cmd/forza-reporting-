import { NextResponse } from "next/server";
import { syncRange } from "@/lib/sync";

export const maxDuration = 300;

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await syncRange(body.startDate, body.endDate);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
