import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "Tutorial College Manager",
    timezone: "Asia/Colombo",
    currency: "LKR",
    timestamp: new Date().toISOString(),
  });
}
