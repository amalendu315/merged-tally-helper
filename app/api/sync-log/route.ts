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
    const {
      region,
      voucher_type,
      submission_date,
      last_updated_date,
      start_date,
      end_date,
      start_voucher,
      end_voucher,
      last_voucher_number,
    } = body;

    const pool = await getConnection();

    // Check if a log already exists for the region and voucher type
    const existingLog = await pool
      .request()
      .input("region", region)
      .input("voucher_type", voucher_type).query(`
        SELECT COUNT(*) as count
        FROM TallyVoucherSyncLog
        WHERE region = @region AND voucher_type = @voucher_type
      `);

    const logExists = existingLog.recordset[0].count > 0;

    if (logExists) {
      // If the log exists, update it
      await pool
        .request()
        .input("region", region)
        .input("voucher_type", voucher_type)
        .input("submission_date", submission_date)
        .input("last_updated_date", last_updated_date)
        .input("last_updated_voucher_number", last_voucher_number)
        .input("start_date", start_date)
        .input("end_date", end_date)
        .input("start_voucher", start_voucher)
        .input("end_voucher", end_voucher).query(`
          UPDATE TallyVoucherSyncLog
          SET 
            submission_date = @submission_date,
            last_updated_date = @last_updated_date,
            last_updated_voucher_number = @last_updated_voucher_number,
            start_date = @start_date,
            end_date = @end_date,
            start_voucher = @start_voucher,
            end_voucher = @end_voucher
          WHERE region = @region AND voucher_type = @voucher_type
        `);
    } else {
      // If the log does not exist, create a new one
      await pool
        .request()
        .input("user_id", parseInt(user_id))
        .input("region", region)
        .input("voucher_type", voucher_type)
        .input("submission_date", submission_date)
        .input("last_updated_date", last_updated_date)
        .input("last_updated_voucher_number", last_voucher_number)
        .input("start_date", start_date)
        .input("end_date", end_date)
        .input("start_voucher", start_voucher)
        .input("end_voucher", end_voucher).query(`
          INSERT INTO TallyVoucherSyncLog
          (user_id, region, voucher_type, submission_date, last_updated_date, last_updated_voucher_number, start_date, end_date, start_voucher, end_voucher)
          VALUES (@user_id, @region, @voucher_type, @submission_date, @last_updated_date, @last_updated_voucher_number ,@start_date, @end_date, @start_voucher, @end_voucher)
        `);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/sync-log failed:", err);
    return NextResponse.json(
      { error: "Insert/Update failed" },
      { status: 500 }
    );
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
