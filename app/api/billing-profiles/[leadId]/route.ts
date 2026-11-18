import { NextResponse } from "next/server";

const gone = () =>
  NextResponse.json(
    { error: "Billing profiles removed. Use /api/invoices/clients/[id]" },
    { status: 410 },
  );

export async function GET() {
  return gone();
}

export async function PATCH() {
  return gone();
}
