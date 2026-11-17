import { NextResponse } from "next/server";

const USER = process.env.LOGIN_USER || "admin";
const PASSWORD = process.env.LOGIN_PASSWORD || "admin123";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.username !== USER || body.password !== PASSWORD) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fb_mnet_session", "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fb_mnet_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
