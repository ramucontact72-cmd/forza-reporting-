import { NextResponse } from "next/server";
import { readFacebookEntity, updateFacebookEntity } from "@/lib/facebook";

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  try {
    return NextResponse.json(await readFacebookEntity(id));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    await updateFacebookEntity(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
