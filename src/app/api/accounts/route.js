import { NextResponse } from "next/server";
import { readDirectory } from "@/lib/directory";

export async function GET() {
  try {
    const directory = await readDirectory();
    return NextResponse.json({ accounts: directory.accounts });
  } catch (error) {
    return NextResponse.json({ accounts: [], error: error.message }, { status: 500 });
  }
}
