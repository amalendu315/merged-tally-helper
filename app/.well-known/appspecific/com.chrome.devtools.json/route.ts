// app/.well-known/appspecific/com.chrome.devtools.json/route.ts

import { NextResponse } from "next/server";

export async function GET() {
  // Option 1: Return 204 (No Content)
//   return new NextResponse(null, { status: 204 });

  // Option 2 (alternative): Return a JSON placeholder
  return NextResponse.json({ message: "Devtools config not available" }, { status: 200 });
}
