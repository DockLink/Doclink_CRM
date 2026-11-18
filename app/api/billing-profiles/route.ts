import { NextResponse } from "next/server";

const gone = () =>
  NextResponse.json(
    { error: "Billing profiles removed. Use /api/invoices/clients" },
    { status: 410 },
  );

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
