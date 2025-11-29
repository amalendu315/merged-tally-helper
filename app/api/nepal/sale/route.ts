// import axios from "axios";
// import { NextResponse } from "next/server";
//
// import { saleCloudAuthToken, saleCloudURL } from "@/constants";
//
// interface ResponseType {
//   data: [
//     {
//       statusmessage: string;
//       statuscode: string;
//       voucherno: string;
//     }
//   ];
// }
//
// export async function POST(request: Request) {
//   try {
//     const { data } = await request.json();
//
//     // Submit the data to the cloud server using Axios
//     const response: ResponseType = await axios.post(
//       saleCloudURL,
//       { data: data },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authtoken: saleCloudAuthToken,
//         },
//       }
//     );
//     console.log(saleCloudAuthToken);
//     return NextResponse.json(response?.data);
//   } catch (error) {
//     console.error("Error submitting data:", error);
//     return NextResponse.json(
//       { error: "Failed to submit vouchers" },
//       { status: 500 }
//     );
//   }
// }

// import axios from "axios";
// import { NextResponse } from "next/server";
// import { saleCloudAuthToken, saleCloudURL } from "@/constants";
// import { getConnection } from "@/lib/db";
//
// // AQNS/0001 style
// function formatVoucherNo(n: number) {
//     return `AQNS/${n.toString().padStart(n >= 1000 ? 4 : 3, "0")}`;
// }
//
// // Only compute candidate (no commit yet)
// async function getCandidateNumber(pool: any, region: string, voucherType: string) {
//     // Ensure counter row exists (FiscalYear = '')
//     await pool.request()
//         .input("region", region)
//         .input("type", voucherType)
//         .query(`
//       IF NOT EXISTS (
//         SELECT 1 FROM dbo.VoucherCounters
//         WHERE Region=@region AND VoucherType=@type AND FiscalYear = ''
//       )
//       INSERT INTO dbo.VoucherCounters (Region, VoucherType, FiscalYear, CurrentNo)
//       VALUES (@region, @type, '', 0);
//     `);
//
//     // Lock + read current
//     const r = await pool.request()
//         .input("region", region)
//         .input("type", voucherType)
//         .query(`
//       SELECT CurrentNo
//       FROM dbo.VoucherCounters WITH (UPDLOCK, HOLDLOCK)
//       WHERE Region=@region AND VoucherType=@type AND FiscalYear = '';
//     `);
//
//     const next = (r.recordset[0].CurrentNo || 0) + 1;
//     const formatted = formatVoucherNo(next);
//     return { next, formatted };
// }
//
// // Commit number after cloud confirms success
// async function commitNumber(pool: any, region: string, voucherType: string, next: number, idempotencyKey: string, voucherNo: string) {
//     const tx = new pool.Transaction();
//     await tx.begin();
//
//     try {
//         // Bump counter
//         const req1 = new pool.Request(tx);
//         await req1
//             .input("region", region)
//             .input("type", voucherType)
//             .input("next", next)
//             .query(`
//         UPDATE dbo.VoucherCounters
//         SET CurrentNo = @next
//         WHERE Region=@region AND VoucherType=@type AND FiscalYear = '';
//       `);
//
//         // Record idempotency
//         const req2 = new pool.Request(tx);
//         await req2
//             .input("key", idempotencyKey)
//             .input("region", region)
//             .input("type", voucherType)
//             .input("no", voucherNo)
//             .query(`
//         INSERT INTO dbo.VoucherIdempotency (IdempotencyKey, Region, VoucherType, VoucherNo)
//         VALUES (@key, @region, @type, @no);
//       `);
//
//         await tx.commit();
//     } catch (e) {
//         await tx.rollback();
//         throw e;
//     }
// }
//
// export async function POST(request: Request) {
//     const pool = await getConnection();
//
//     try {
//         const { data } = await request.json(); // array of sales vouchers (WITHOUT voucherno)
//         const results: Array<{ idempotencyKey: string; ok: boolean; voucherno?: string; message?: string }> = [];
//
//         for (const item of data) {
//             const region = item.region || "nepal";
//             const voucherType = item.vouchertype || "Sales";
//             const idempotencyKey = item.idempotencyKey;
//
//             if (!idempotencyKey) {
//                 results.push({ idempotencyKey: "(missing)", ok: false, message: "idempotencyKey required" });
//                 continue;
//             }
//
//             try {
//                 // Check idempotency first
//                 const check = await pool.request()
//                     .input("key", idempotencyKey)
//                     .query(`SELECT VoucherNo FROM dbo.VoucherIdempotency WHERE IdempotencyKey=@key`);
//
//                 if (check.recordset.length) {
//                     const reused = check.recordset[0].VoucherNo;
//
//                     // Build STRICT cloud payload: strip helper fields
//                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//                     const { idempotencyKey: _k, region: _r, ...clean } = item;
//                     const payload = { ...clean, voucherno: reused };
//                     console.log("FINAL CLOUD PAYLOAD:", JSON.stringify({ data: [payload] }, null, 2));
//                     const resp = await axios.post(
//                         saleCloudURL,
//                         { data: [payload] },
//                         { headers: { "Content-Type": "application/json", Authtoken: saleCloudAuthToken } }
//                     );
//
//                     const ok =
//                         Array.isArray(resp?.data) &&
//                         (resp.data[0]?.statuscode === "101" || resp.data[0]?.statuscode === 101);
//
//                     if (!ok) throw new Error(resp?.data?.data?.[0]?.statusmessage || "Cloud rejected");
//
//                     results.push({ idempotencyKey, ok: true, voucherno: reused });
//                     continue;
//                 }
//
//                 // Serialize numbering with applock
//                 await pool.request()
//                     .input("name", `lock:${region}:${voucherType}`)
//                     .query(`EXEC sp_getapplock @Resource=@name, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=15000;`);
//
//                 try {
//                     // Candidate number (not committed)
//                     const cand = await getCandidateNumber(pool, region, voucherType);
//                     const voucherno = cand.formatted;
//
//                     // STRICT cloud payload: strip helper fields
//                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//                     const { idempotencyKey: _k2, region: _r2, ...clean } = item;
//                     const payload = { ...clean, voucherno };
//                     console.log("FINAL CLOUD PAYLOAD:", JSON.stringify({ data: [payload] }, null, 2));
//                     const resp = await axios.post(
//                         saleCloudURL,
//                         { data: [payload] },
//                         { headers: { "Content-Type": "application/json", Authtoken: saleCloudAuthToken } }
//                     );
//
//                     // LOG THE SUCCESS RESPONSE
//                     console.log("Cloud Response Status:", resp.status);
//                     console.log("Cloud Response Body:", JSON.stringify(resp.data, null, 2));
//
//                     const ok =
//                         Array.isArray(resp?.data) &&
//                         (resp.data[0]?.statuscode === "101" || resp.data[0]?.statuscode === 101);
//
//                     if (!ok) {
//                         console.error("Cloud Rejected Voucher:", payload.voucherno);
//                         console.error("Rejection Reason:", resp?.data?.data?.[0]?.statusmessage);
//                         throw new Error(resp?.data?.data?.[0]?.statusmessage || "Cloud rejected");
//                     }
//
//                     // Commit number AFTER success
//                     await commitNumber(pool, region, voucherType, cand.next, idempotencyKey, voucherno);
//
//                     results.push({ idempotencyKey, ok: true, voucherno });
//                 } finally {
//                     await pool.request()
//                         .input("name", `lock:${region}:${voucherType}`)
//                         .query(`EXEC sp_releaseapplock @Resource=@name, @LockOwner='Session';`);
//                 }
//             } catch (err: any) {
//                 results.push({ idempotencyKey, ok: false, message: err?.message || "failed" });
//             }
//         }
//
//         return NextResponse.json({ results }, { status: 200 });
//     } catch (error) {
//         console.error("Error submitting sales vouchers:", error);
//         return NextResponse.json({ error: "Failed to submit sales vouchers" }, { status: 500 });
//     }
// }
import axios from "axios";
import { NextResponse } from "next/server";
import { saleCloudAuthToken, saleCloudURL } from "@/constants";
import { getConnection } from "@/lib/db";
import sql from "mssql";

// AQNS/0001 style
function formatVoucherNo(n: number) {
    return `AQNS/${n.toString().padStart(n >= 1000 ? 4 : 3, "0")}`;
}

// 1. GET CANDIDATE (Read the current number)
async function getCandidateNumber(pool: any, region: string, voucherType: string) {
    // Ensure counter row exists. We use ISNULL to handle empty strings/nulls safely.
    await pool.request()
        .input("region", region)
        .input("type", voucherType)
        .query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.VoucherCounters
        WHERE Region=@region AND VoucherType=@type AND (FiscalYear = '' OR FiscalYear IS NULL)
      )
      INSERT INTO dbo.VoucherCounters (Region, VoucherType, FiscalYear, CurrentNo)
      VALUES (@region, @type, '', 0);
    `);

    // Read current
    const r = await pool.request()
        .input("region", region)
        .input("type", voucherType)
        .query(`
      SELECT CurrentNo
      FROM dbo.VoucherCounters
      WHERE Region=@region AND VoucherType=@type AND (FiscalYear = '' OR FiscalYear IS NULL);
    `);

    const current = r.recordset[0]?.CurrentNo || 0;
    const next = current + 1;
    const formatted = formatVoucherNo(next);

    return { next, formatted };
}

// 2. COMMIT NUMBER (Update the DB)
async function commitNumber(pool: any, region: string, voucherType: string, next: number, idempotencyKey: string, voucherNo: string) {
    // FIX: Use sql.Transaction instead of pool.Transaction
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        // FIX: Use sql.Request(tx) instead of pool.Request(tx)
        const req1 = new sql.Request(tx);
        const updateResult = await req1
            .input("region", region)
            .input("type", voucherType)
            .input("next", next)
            .query(`
        UPDATE dbo.VoucherCounters
        SET CurrentNo = @next
        WHERE Region=@region AND VoucherType=@type AND (FiscalYear = '' OR FiscalYear IS NULL);
      `);

        // CRITICAL FIX: Check if the update actually happened
        if (updateResult.rowsAffected[0] === 0) {
            throw new Error(`CRITICAL: Failed to update voucher counter. Region: ${region}, Type: ${voucherType}`);
        }

        const req2 = new sql.Request(tx);
        await req2
            .input("key", idempotencyKey)
            .input("region", region)
            .input("type", voucherType)
            .input("no", voucherNo)
            .query(`
        INSERT INTO dbo.VoucherIdempotency (IdempotencyKey, Region, VoucherType, VoucherNo)
        VALUES (@key, @region, @type, @no);
      `);

        await tx.commit();
        console.log(`✅ Database updated: ${voucherNo} (Counter: ${next})`);
    } catch (e) {
        await tx.rollback();
        console.error("❌ Database Commit Failed:", e);
        throw e;
    }
}

export async function POST(request: Request) {
    const pool = await getConnection();

    try {
        const { data } = await request.json();
        const results: Array<{ idempotencyKey: string; ok: boolean; voucherno?: string; message?: string }> = [];

        // Process sequentially (one by one) to ensure numbering order
        for (const item of data) {
            const region = item.region || "nepal";
            const voucherType = item.vouchertype || "Sales";
            const idempotencyKey = item.idempotencyKey;

            if (!idempotencyKey) {
                results.push({ idempotencyKey: "(missing)", ok: false, message: "idempotencyKey required" });
                continue;
            }

            try {
                // A. Check Idempotency (Already processed?)
                const check = await pool.request()
                    .input("key", idempotencyKey)
                    .query(`SELECT VoucherNo FROM dbo.VoucherIdempotency WHERE IdempotencyKey=@key`);

                if (check.recordset.length) {
                    const reused = check.recordset[0].VoucherNo;
                    console.log(`♻️ Skipping cloud, already exists: ${reused}`);
                    results.push({ idempotencyKey, ok: true, voucherno: reused });
                    continue;
                }

                // B. Get Candidate Number (From DB)
                const cand = await getCandidateNumber(pool, region, voucherType);
                const voucherno = cand.formatted;

                // C. Prepare Payload
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { idempotencyKey: _k2, region: _r2, ...clean } = item;
                const payload = { ...clean, voucherno };

                console.log(`📤 Sending ${voucherno} to Cloud...`);

                // D. Send to Cloud
                const resp = await axios.post(
                    saleCloudURL,
                    { data: [payload] },
                    { headers: { "Content-Type": "application/json", Authtoken: saleCloudAuthToken } }
                );

                const ok =
                    Array.isArray(resp?.data) &&
                    (resp.data[0]?.statuscode === "101" || resp.data[0]?.statuscode === 101);

                if (!ok) {
                    const msg = resp?.data[0]?.statusmessage || resp?.data[0]?.statusmessage || "Cloud rejected";
                    throw new Error(msg);
                }

                // E. Commit Number (Update DB)
                // If this fails, it throws, and we catch it below (allowing retry later)
                await commitNumber(pool, region, voucherType, cand.next, idempotencyKey, voucherno);

                results.push({ idempotencyKey, ok: true, voucherno });

            } catch (err: any) {
                console.error(`💥 Error processing ${idempotencyKey}:`, err.message);
                results.push({ idempotencyKey, ok: false, message: err?.message || "failed" });
            }
        }

        return NextResponse.json({ results }, { status: 200 });
    } catch (error) {
        console.error("Global Error:", error);
        return NextResponse.json({ error: "Failed to submit sales vouchers" }, { status: 500 });
    }
}