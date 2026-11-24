import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request);

  if (errorResponse) {
    return errorResponse;
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}
