import { NextResponse } from "next/server";
import { accountDirectory } from "@/lib/facebook";

export async function GET() {
  try {
    const directory = await accountDirectory();
    return NextResponse.json({ accounts: directory.accounts });
  } catch (error) {
    return NextResponse.json({ accounts: [], error: error.message }, { status: 500 });
  }
}
