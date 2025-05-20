import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
// POST: Save sync log
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    console.log(session);
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();

    const { // fallback user
      region,
      voucher_type,
      submission_date,
      last_updated_date,
      start_date,
      end_date,
      start_voucher,
      end_voucher,
    } = body;

    const pool = await getConnection();
    await pool
      .request()
      .input("user_id", parseInt(user_id))
      .input("region", region)
      .input("voucher_type", voucher_type)
      .input("submission_date", submission_date)
      .input("last_updated_date", last_updated_date)
      .input("start_date", start_date)
      .input("end_date", end_date)
      .input("start_voucher", start_voucher)
      .input("end_voucher", end_voucher).query(`
        INSERT INTO TallyVoucherSyncLog
        (user_id, region, voucher_type, submission_date, last_updated_date, start_date, end_date, start_voucher, end_voucher)
        VALUES (@user_id, @region, @voucher_type, @submission_date, @last_updated_date, @start_date, @end_date, @start_voucher, @end_voucher)
      `);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/sync-log failed:", err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}

// GET: Fetch latest sync log by region + type
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const voucher_type = searchParams.get("type");

    const pool = await getConnection();
    const result = await pool
      .request()
      .input("region", region)
      .input("voucher_type", voucher_type).query(`
        SELECT TOP 1 *
        FROM TallyVoucherSyncLog
        WHERE region = @region AND voucher_type = @voucher_type
        ORDER BY created_at DESC
      `);

    const log = result.recordset[0];

    if (!log) {
      return NextResponse.json({ data: null }, { status: 204 });
    }

    return NextResponse.json({ data: log }, { status: 200 });
  } catch (err) {
    console.error("GET /api/sync-log failed:", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
