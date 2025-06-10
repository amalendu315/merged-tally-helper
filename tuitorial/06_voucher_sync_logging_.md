# Chapter 6: Voucher Sync Logging

Welcome back! In our last chapter, [Chapter 5: External API Integration](05_external_api_integration_.md), we saw how our application talks to other systems – fetching raw data from one Tally API and pushing processed voucher data to different Tally Cloud APIs. Making these external calls is essential, but how do we keep track of *what* data has been sent and *when*? If we don't, we might accidentally send the same vouchers multiple times, causing problems in the destination Tally system.

Imagine you're sending important packages. You wouldn't just drop them off and forget about them! You'd keep a record: which packages were sent, when, and to whom. This record helps you confirm deliveries and avoid sending duplicates.

This is the problem solved by **Voucher Sync Logging**.

## The Problem: Remembering What Was Sent

When you use `merged-tally-helper` to push a batch of vouchers to the Tally Cloud, that's like sending a package. The application needs a way to record the details of this "delivery" so it can:

1.  **Show the User:** Display a summary of the last successful push, like "Last synced on [date], vouchers #1001 to #1050 from [start date] to [end date]". This gives the user confidence and context.
2.  **Prevent Duplicates:** Before allowing another push, check if the user is trying to send vouchers that are *already* marked as successfully synced.
3.  **Provide Audit Trail:** Have a history of sync actions for troubleshooting or review.

Without this system, the application would be "forgetful" about its past actions, leading to confusion and potential data errors.

## What is Voucher Sync Logging?

In the `merged-tally-helper` project, **Voucher Sync Logging** is the system that tracks the history of data pushes (syncs) to the Tally Cloud APIs. It stores crucial details about each successful sync operation.

Think of it as the application's **delivery manifest logbook**. Every time it successfully sends a batch of vouchers, it writes an entry in this logbook detailing:

*   When the sync happened.
*   Which region's data was synced (India Sales, India Return, Nepal Sales, Nepal Purchase).
*   The date range of the *original* sales data from which the vouchers were extracted for this sync.
*   The range of *voucher numbers* included in this specific sync batch.
*   (For Nepal Sales) The last voucher number used in the sequence.

This logbook is stored persistently in our internal database ([Chapter 3: Database Access](03_database_access_.md)).

## The Use Case: Displaying Last Sync Info and Checking Duplicates

The primary use case for the user is seeing the "Last Sync Summary" on their dashboard page and being warned if they try to push vouchers that were part of a previously logged sync.

Here's how the logging system supports this:

1.  **When the page loads:** The application fetches the *most recent* log entry for the current region (India/Nepal) and voucher type (Sales/Return) from the database.
2.  **Displaying the Summary:** It takes the details from this log entry (submission date, voucher range, dates) and displays them in a dedicated section on the dashboard UI (like the "India Sync Summary" card).
3.  **Checking for Duplicates (Before Push):** When the user clicks the "Submit to Cloud" button, before actually sending data to the external API ([Chapter 5](05_external_api_integration_.md)), the application checks if any of the currently selected voucher numbers fall within the range (`start_voucher` to `end_voucher`) recorded in the *last* sync log entry displayed. If they do, it shows a warning and prevents the push.

This requires reading from and writing to a specific table in our database and handling this logic in the frontend and backend.

## Storing the Log: The `TallyVoucherSyncLog` Table

The sync history is stored in a dedicated table in the SQL Server database ([Chapter 3: Database Access](03_database_access_.md)). The relevant columns in this table include:

*   `region` (e.g., 'india', 'nepal', 'all')
*   `voucher_type` (e.g., 'sales', 'return', 'purchase')
*   `submission_date` (When this sync record was created/updated)
*   `last_updated_date` (The date of the latest voucher included in this sync batch)
*   `start_date`, `end_date` (The original date range used to *fetch* the vouchers for this sync)
*   `start_voucher`, `end_voucher` (The range of *voucher numbers* included in this sync)
*   `last_voucher_number` (Specific to Nepal Sales, tracks the sequence number)
*   `user_id` (Who performed the sync, linked to the `TallyUsers` table - [Chapter 4](04_authentication_system_.md))
*   `created_at`, `updated_at` (Standard timestamps)

There is usually only **one active log entry** per `region` and `voucher_type`. When a new sync for that region/type happens, the existing entry is *updated* with the latest information rather than creating a new row. This keeps the "Last Sync Summary" simple – it's just the single entry for that specific category.

## The Sync Log API Route (`app/api/sync-log/route.ts`)

All interactions with the `TallyVoucherSyncLog` table happen through a specific Next.js API route: `app/api/sync-log/route.ts`. This route has two main functions:

*   `GET`: To fetch the latest sync log entry for a given region and voucher type.
*   `POST`: To save (insert or update) a new sync log entry after a successful push.

Both functions use the database connection helper `getConnection()` from `lib/db.ts` ([Chapter 3: Database Access](03_database_access_.md)) to interact with the SQL Server database.

### 1. Fetching the Last Sync Log (`GET /api/sync-log`)

When a dashboard page (like India Sales or Nepal Sales) loads, it needs to show the last sync status. The frontend makes a `GET` request to `/api/sync-log`, passing the `region` and `type` as query parameters.

Here's a simplified look at the `GET` handler:

```typescript
// app/api/sync-log/route.ts (Simplified GET)
import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db"; // Database helper (Chapter 3)

export async function GET(req: NextRequest) {
  try {
    // Get region and type from URL query parameters
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const voucher_type = searchParams.get("type");

    const pool = await getConnection(); // Get DB connection pool (Chapter 3)
    const result = await pool
      .request()
      .input("region", region) // Add region parameter safely
      .input("voucher_type", voucher_type) // Add type parameter safely
      .query(`
        SELECT TOP 1 *
        FROM TallyVoucherSyncLog
        WHERE region = @region AND voucher_type = @voucher_type
        ORDER BY created_at DESC
      `); // SQL query to get the latest log

    const log = result.recordset[0]; // Get the first (latest) row

    if (!log) {
      // No log found for this region/type
      return NextResponse.json({ data: null }, { status: 204 });
    }

    // Return the log data
    return NextResponse.json({ data: log }, { status: 200 });
  } catch (err) {
    console.error("GET /api/sync-log failed:", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
```

**Explanation:**

*   The function reads the `region` and `voucher_type` from the request URL.
*   It gets the database connection pool using `getConnection()`.
*   It prepares an SQL request using `pool.request()` and safely adds the region and type as parameters using `.input()`.
*   The SQL query selects the top 1 row (`SELECT TOP 1`) from `TallyVoucherSyncLog` where the `region` and `voucher_type` match, ordered by `created_at` descending to get the *latest* entry.
*   The result is extracted (`result.recordset[0]`) and returned as a JSON response.

On the frontend, in the `VoucherForm` components (`components/india/VoucherForm.tsx`, `components/nepal/VoucherForm.tsx`, etc.), an `useEffect` hook calls this API when the component mounts to fetch the last sync metadata and store it in the component's state (`syncMeta`):

```typescript
// components/india/VoucherForm.tsx (Simplified frontend fetch)
"use client";
import { useEffect, useState } from "react";
// ... other imports

export default function IndiaVoucherForm() {
  const [syncMeta, setSyncMeta] = useState<any | null>(null);
  // ... other state (vouchers, loading, etc.)

  useEffect(() => {
    const loadSyncMeta = async () => {
      try {
        // Fetch the last sync log for India Sales
        const res = await fetch("/api/sync-log?region=india&type=sales");
        if (res.status === 200) {
          const result = await res.json();
          setSyncMeta(result.data); // Store the fetched log data in state
        }
      } catch (err) {
        console.error("Failed to fetch sync log", err);
      }
    };
    loadSyncMeta(); // Call the function when the component mounts
  }, []); // Empty dependency array means run once on mount

  // ... rest of the component ...

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* LEFT PANEL - Displaying Sync Summary */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 India Sync Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Displaying data from the syncMeta state */}
            <p>Submission Date: {syncMeta?.submission_date ? format(new Date(syncMeta.submission_date), 'yyyy-MM-dd') : 'N/A'}</p>
            <p>Voucher Range: #{syncMeta?.start_voucher} → #{syncMeta?.end_voucher}</p>
            {/* ... other summary details */}
          </CardContent>
        </Card>
        {/* ... Right Panel and Table */}
      </div>
    </>
  );
}
```

This fetched `syncMeta` state is then used to populate the summary card UI and is also available for the duplicate check logic before pushing.

### 2. Saving a New Sync Log (`POST /api/sync-log`)

After a batch of vouchers is successfully pushed to the external Tally Cloud API ([Chapter 5](05_external_api_integration_.md)), the application needs to record this event in the log. The frontend's `handlePushToCloud` function makes a `POST` request to `/api/sync-log` with the sync details in the request body.

Here's a simplified look at the `POST` handler:

```typescript
// app/api/sync-log/route.ts (Simplified POST)
import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db"; // Database helper (Chapter 3)
import { getServerSession } from "next-auth"; // Auth helper (Chapter 4)
import { authOptions } from "@/lib/authOptions"; // Auth config (Chapter 4)

export async function POST(req: NextRequest) {
  try {
    // Check user authentication (Chapter 4)
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sync details from the request body
    const body = await req.json();
    const { region, voucher_type, submission_date, start_date, end_date, start_voucher, end_voucher, last_voucher_number } = body;
    // ... (getting last_updated_date is also included in actual code)

    const pool = await getConnection(); // Get DB connection pool (Chapter 3)

    // Check if a log already exists for this region/type
    const existingLog = await pool
      .request()
      .input("region", region)
      .input("voucher_type", voucher_type)
      .query(`SELECT COUNT(*) as count FROM TallyVoucherSyncLog WHERE region = @region AND voucher_type = @voucher_type`); // Check if exists

    const logExists = existingLog.recordset[0].count > 0;

    const request = pool.request(); // Prepare request for INSERT or UPDATE
    // Add all input parameters safely
    request.input("region", region);
    request.input("voucher_type", voucher_type);
    request.input("submission_date", submission_date);
    request.input("start_date", start_date);
    request.input("end_date", end_date);
    request.input("start_voucher", start_voucher);
    request.input("end_voucher", end_voucher);
    request.input("last_voucher_number", last_voucher_number); // For Nepal
    request.input("user_id", parseInt(user_id)); // Link to user (Chapter 4)
    // ... (add last_updated_date input)


    if (logExists) {
      // If log exists, UPDATE the existing row
      await request.query(`
        UPDATE TallyVoucherSyncLog
        SET
          submission_date = @submission_date,
          start_date = @start_date,
          end_date = @end_date,
          start_voucher = @start_voucher,
          end_voucher = @end_voucher,
          last_voucher_number = @last_voucher_number, -- For Nepal
          updated_at = GETDATE()
          -- ... (update last_updated_date)
        WHERE region = @region AND voucher_type = @voucher_type
      `);
    } else {
      // If log doesn't exist, INSERT a new row
      await request.query(`
        INSERT INTO TallyVoucherSyncLog
        (user_id, region, voucher_type, submission_date, start_date, end_date, start_voucher, end_voucher, last_voucher_number)
        VALUES (@user_id, @region, @voucher_type, @submission_date, @start_date, @end_date, @start_voucher, @end_voucher, @last_voucher_number)
        -- ... (include last_updated_date field)
      `);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/sync-log failed:", err);
    return NextResponse.json({ error: "Insert/Update failed" }, { status: 500 });
  }
}
```

**Explanation:**

*   The function first checks if the user is authenticated using `getServerSession` ([Chapter 4](04_authentication_system_.md)).
*   It reads the sync details sent in the request body by the frontend.
*   It gets the database connection pool using `getConnection()`.
*   It checks if a log entry already exists for the given `region` and `voucher_type`.
*   It prepares an SQL request with all the necessary input parameters using `pool.request().input(...)`.
*   Based on the `logExists` check, it executes either an `UPDATE` query (if a log exists) or an `INSERT` query (if it doesn't) to save the new sync details.
*   It returns a success response.

On the frontend, in the `handlePushToCloud` function (in `VoucherForm` components), after the call to the external cloud API (`/api/india/cloud`, `/api/nepal/sale`, etc. - [Chapter 5](05_external_api_integration_.md)) is successful, this function calls the `/api/sync-log` endpoint with the `POST` method:

```typescript
// components/india/VoucherForm.tsx (Simplified frontend POST)
  const handlePushToCloud = async () => {
    // ... (initial checks and setup)

    try {
      // ... (filter selected vouchers, prepare payload)
      // ... (Submit data to external cloud API using fetch/axios - Chapter 5)

      // Assuming push to external API was successful...

      const currentDate = new Date().toISOString().split("T")[0];
      const firstSelectedVoucher = selected.at(0);
      const lastSelectedVoucher = selected.at(-1);

      const body = {
        region: "india", // Hardcoded for India page
        voucher_type: "sales", // Hardcoded for Sales form
        submission_date: currentDate,
        last_updated_date: lastSelectedVoucher?.InvoiceEntryDate?.split("T")[0] || "", // Date of last voucher in batch
        start_date: dateRange.start, // Original fetch start date
        end_date: dateRange.end,     // Original fetch end date
        start_voucher: firstSelectedVoucher?.InvoiceNo || 0, // First voucher number in batch
        end_voucher: lastSelectedVoucher?.InvoiceNo || 0,   // Last voucher number in batch
        // last_voucher_number is only relevant for Nepal Sales
      };

      // Call our internal API to save the sync log
      await fetch("/api/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      toast.success("Vouchers pushed successfully!");
      setSelectedInvoiceNos([]); // Clear selection after successful push (Chapter 2)

    } catch (err) {
      // ... error handling ...
    } finally {
      // ... final state updates ...
    }
  };
```

This ensures that a record is created in our database only *after* the external push is confirmed, preventing the log from showing successful pushes that didn't actually happen.

### 3. Preventing Duplicate Pushes (Frontend Logic)

The frontend uses the `syncMeta` state (fetched via the `GET` request) to check for duplicate selections *before* calling the external API push route (`/api/india/cloud`, etc.). This check is done within the `handlePushToCloud` function:

```typescript
// components/india/VoucherForm.tsx (Simplified duplicate check)
  const handlePushToCloud = async () => {
    if (!selectedInvoiceNos.length) {
      toast.error("Select vouchers to push");
      return;
    }

    // Use the fetched syncMeta state to check the last pushed range
    const pushedRange = {
      start: syncMeta?.start_voucher ?? 0, // Default to 0 if no log exists
      end: syncMeta?.end_voucher ?? 0,     // Default to 0 if no log exists
    };

    // Filter selected vouchers to find any that fall within the last pushed range
    const duplicates = selectedVouchers.filter( // 'selectedVouchers' is the filtered list of selected vouchers
      (v) =>
        v.InvoiceNo >= pushedRange.start &&
        v.InvoiceNo <= pushedRange.end &&
        v.InvoiceNo !== 0 // Exclude cases where voucher number is 0
    );

    if (duplicates.length > 0) {
      toast.error(
        `Duplicate vouchers selected: ${duplicates.map((v) => v.InvoiceNo).join(", ")}`
      );
      setUploading(false); // Cancel the push process
      return; // Stop the function execution
    }

    // If no duplicates found, proceed with the push to external API and then save the log
    // ... (rest of the handlePushToCloud function) ...
  }
```

This client-side check provides immediate feedback to the user if they try to re-push already synced vouchers based on the last recorded range.

## How It Works (Under the Hood)

Let's visualize the two main flows involving the sync log:

**1. Fetching and Displaying the Last Sync Log:**

```mermaid
sequenceDiagram
    participant User
    participant Dashboard Page (Client)
    participant /api/sync-log GET (Server)
    participant getConnection (lib/db.ts)
    participant SQL Server Database

    User->>Dashboard Page (Client): Navigates to page
    Dashboard Page (Client)->>Dashboard Page (Client): useEffect triggers loadSyncMeta
    Dashboard Page (Client)->>/api/sync-log GET (Server): Fetch GET /api/sync-log?region=...&type=...
    /api/sync-log GET (Server)->>getConnection (lib/db.ts): Call getConnection()
    getConnection (lib/db.ts)->>SQL Server Database: Get connection from pool (Chapter 3)
    SQL Server Database-->>getConnection (lib/db.ts): Connection ready
    getConnection (lib/db.ts)-->>/api/sync-log GET (Server): Return connection pool
    /api/sync-log GET (Server)->>SQL Server Database: Execute SELECT TOP 1 query on TallyVoucherSyncLog
    SQL Server Database-->>/api/sync-log GET (Server): Return latest log data (or none)
    /api/sync-log GET (Server)-->>Dashboard Page (Client): Send JSON response with log data
    Dashboard Page (Client)->>Dashboard Page (Client): Update syncMeta state
    Dashboard Page (Client)->>User: Display Sync Summary card using syncMeta data
```

1.  The user loads a dashboard page (e.g., `/india`).
2.  The `useEffect` hook in the `VoucherForm` component runs.
3.  It makes a `GET` request to our `/api/sync-log` server route, including the relevant region and type.
4.  The API route handler gets a database connection using `getConnection()`.
5.  It runs an SQL query to find the most recent log entry for that region/type in `TallyVoucherSyncLog`.
6.  The database returns the log data (or indicates none was found).
7.  The API route sends this data back to the frontend.
8.  The frontend updates its `syncMeta` state with the received data.
9.  The UI (the summary card) re-renders, displaying the information from the `syncMeta` state.

**2. Saving a New Sync Log Entry:**

```mermaid
sequenceDiagram
    participant User
    participant Dashboard Page (Client)
    participant External Cloud API Push (Server)
    participant /api/sync-log POST (Server)
    participant getConnection (lib/db.ts)
    participant SQL Server Database

    User->>Dashboard Page (Client): Clicks "Submit to Cloud"
    Dashboard Page (Client)->>Dashboard Page (Client): Performs duplicate check using syncMeta
    alt No duplicates
        Dashboard Page (Client)->>External Cloud API Push (Server): Calls API route to push data (Chapter 5)
        External Cloud API Push (Server)-->>Dashboard Page (Client): Push successful response
        Dashboard Page (Client)->>Dashboard Page (Client): Prepare log data (region, dates, voucher range)
        Dashboard Page (Client)->>/api/sync-log POST (Server): Fetch POST /api/sync-log with log data in body
        /api/sync-log POST (Server)->>getConnection (lib/db.ts): Call getConnection()
        getConnection (lib/db.ts)->>SQL Server Database: Get connection from pool (Chapter 3)
        SQL Server Database-->>getConnection (lib/db.ts): Connection ready
        getConnection (lib/db.ts)-->>/api/sync-log POST (Server): Return connection pool
        /api/sync-log POST (Server)->>SQL Server Database: Check if log exists (SELECT COUNT)
        SQL Server Database-->>/api/sync-log POST (Server): Return count
        /api/sync-log POST (Server)->>SQL Server Database: Execute INSERT or UPDATE query to save log
        SQL Server Database-->>/api/sync-log POST (Server): Confirm save
        /api/sync-log POST (Server)-->>Dashboard Page (Client): Send success response
        Dashboard Page (Client)->>User: Show success toast, clear selection (Chapter 2)
    else Duplicates found
        Dashboard Page (Client)->>User: Show error toast, prevent push
    end
```

1.  The user clicks "Submit to Cloud" on the dashboard page.
2.  The frontend's `handlePushToCloud` function runs.
3.  It checks the `selectedInvoiceNos` against the `start_voucher` and `end_voucher` stored in the `syncMeta` state.
4.  If no duplicates are found, it proceeds to call the relevant API route (e.g., `/api/india/cloud`) to push the data to the external Tally API ([Chapter 5](05_external_api_integration_.md)).
5.  Assuming the external push is successful, the frontend prepares the log data.
6.  It makes a `POST` request to our `/api/sync-log` server route with the log data in the body.
7.  The API route handler gets a database connection, checks if an entry for this region/type exists, and then executes either an `UPDATE` or `INSERT` query on `TallyVoucherSyncLog`.
8.  The database confirms the data is saved.
9.  The API route sends a success response back to the frontend.
10. The frontend shows a success message and clears the voucher selection.

This two-way interaction with the `/api/sync-log` route ensures the application's "memory" of past syncs is kept up-to-date and is used to inform the user and prevent errors.

## Summary of Key Components

| Component                    | Role                                                                    | Where to find it                                     | Analogy              |
| :--------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------- | :------------------- |
| `TallyVoucherSyncLog` Table  | Database table storing the history of sync operations.                  | SQL Server Database (managed via `lib/db.ts`)        | The Physical Logbook |
| `/api/sync-log` Route        | Server-side endpoint for fetching and saving sync log data.             | `app/api/sync-log/route.ts`                          | The Logbook Manager's Desk |
| `GET /api/sync-log` Handler  | Fetches the latest log entry for a specific region/type from the DB.    | `app/api/sync-log/route.ts` (`GET` function)         | The "Find Last Entry" Process |
| `POST /api/sync-log` Handler | Saves (inserts or updates) a log entry in the DB after a successful push. | `app/api/sync-log/route.ts` (`POST` function)        | The "Record New Entry" Process |
| `VoucherForm` Components     | Fetch log on mount (`useEffect`), display summary, and check duplicates before pushing. | `components/india/VoucherForm.tsx`, etc.             | The UI interacting with the Logbook |
| `syncMeta` State Variable    | Frontend state holding the latest sync log data fetched from the API.   | Inside `VoucherForm` components (`useState`)         | The Displayed Summary Card |
| Database Access ([Chapter 3]) | Provides the connection and tools (`getConnection`, `pool.request`, `query`) to interact with the `TallyVoucherSyncLog` table. | `lib/db.ts`, API route code | The Librarian who reads/writes |
| External API Integration ([Chapter 5]) | The process of *actual* data push that *precedes* saving the log. | `app/api/*/cloud/route.ts` etc. (called before POST /api/sync-log) | The Delivery Service (whose success is logged) |

## Conclusion

In this chapter, you learned about the **Voucher Sync Logging** system in `merged-tally-helper`. You saw how it acts as a crucial record of successful data pushes, stored in the `TallyVoucherSyncLog` database table. We explored how the `/api/sync-log` route is used to fetch the latest sync details when a page loads (via a `GET` request) to display the summary and how it's called again *after* a successful external push (via a `POST` request) to save the new log entry. You also saw how the frontend uses the fetched log data (`syncMeta`) to prevent accidental duplicate pushes.

Keeping this log is vital for the reliability and usability of the application, providing users with important feedback and preventing data inconsistencies. So far, we've focused on the underlying logic and data flow. In the next chapter, we'll shift our attention to what the user actually *sees* and interacts with: the [User Interface (ShadCN/Tailwind)](07_user_interface__shadcn_tailwind__.md).

---