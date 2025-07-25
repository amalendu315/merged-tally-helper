"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVoucherSelection } from "@/context/VoucherSelectionContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import VoucherList from "./VoucherList";

export default function AllVoucherForm() {
  const userId = "1"; // Placeholder for user ID
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [syncMeta, setSyncMeta] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  const { totalSum, setTotalSum, setSelectedInvoiceNos, selectedInvoiceNos } =
    useVoucherSelection();

  useEffect(() => {
    const loadSyncMeta = async () => {
      try {
        const res = await fetch("/api/sync-log?region=all&type=sales");
        if (res.status === 200) {
          const result = await res.json();
          setSyncMeta(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch sync log", err);
      }
    };
    loadSyncMeta();
  }, []);

  const formatDate = (dateStr?: string) =>
    dateStr ? format(new Date(dateStr), "yyyy-MM-dd") : "N/A";

  const handleFetch = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Please select both start and end date.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/sales?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );

      const data = await response?.json();
      if (!response?.ok) {
        toast.error("No Data Found");
      } else {
        const testKeywords = ["test", "dummy", "demo", "xyz", "airline test"];

        const sortedVouchers = [...data.data]
          .filter(
            (voucher) =>
              voucher.Types === "Invoice" &&
              !testKeywords.some((keyword) =>
                voucher.AccountName?.toLowerCase().includes(keyword)
              )
          )
          .sort((a, b) => {
            if (a.InvoiceNo !== b.InvoiceNo) {
              return a.InvoiceNo - b.InvoiceNo;
            }
            return (
              new Date(b.SaleEntryDate).getTime() -
              new Date(a.SaleEntryDate).getTime()
            );
          });

        setVouchers(sortedVouchers);
        setSelectedInvoiceNos([]);

        const total = sortedVouchers.reduce(
          (sum: number, v: any) => sum + v.FinalRate * v.pax,
          0
        );
        setTotalSum(total);
        toast.success(`Loaded ${sortedVouchers.length} vouchers`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch vouchers");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!vouchers.length) return toast.error("No vouchers to export.");

    const selected = selectedInvoiceNos.length
      ? vouchers.filter((v) => selectedInvoiceNos.includes(v.InvoiceNo))
      : vouchers;

    if (!selected.length) return toast.error("No selected vouchers to export.");

    const formatted = selected.map((v) => ({
      InvoiceNo: v.InvoiceNo,
      SaleEntryDate: v.SaleEntryDate,
      PNR: v.Pnr,
      Pax: v.pax,
      Account: v.AccountName,
      FinalRate: v.FinalRate,
      Total: v.FinalRate * v.pax,
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vouchers");
    XLSX.writeFile(wb, "Selected_Vouchers.xlsx");

    toast.success("Exported to Excel");
  };

  const handlePushToCloud = async () => {
    if (!selectedInvoiceNos.length)
      return toast.error("Select vouchers to push");

    setPushing(true);
    try {
      const selected = vouchers.filter((v) => {
        const inSelection = selectedInvoiceNos.includes(v.InvoiceNo);
        const isDuplicate =
          syncMeta?.start_voucher &&
          syncMeta?.end_voucher &&
          v.InvoiceNo >= syncMeta.start_voucher &&
          v.InvoiceNo <= syncMeta.end_voucher;

        if (inSelection && isDuplicate) {
          toast.error(`Voucher ${v.InvoiceNo} already pushed!`);
          return false;
        }

        return inSelection;
      });

      const prepareData = (entries: any[]): any[] => {
        return entries.map((v) => ({
          branchName: "AirIQ",
          vouchertype: "Sales",
          voucherno: `${v.FinPrefix}${v.InvoiceNo}`,
          voucherdate: v.SaleEntryDate.split("T")[0].replace(/-/g, "/"),
          narration: `${v.Pnr} | PAX :- ${v.pax}`,
          ledgerAllocation: [
            {
              lineno: 1,
              ledgerName:
                v.Country?.toLowerCase() === "nepal"
                  ? "Air IQ Nepal"
                  : v.AccountName,
              ledgerAddress: `${v.Add1 ?? ""}, ${v.Add2 ?? ""}, ${
                v.CityName ?? ""
              } - ${v.Pin ?? ""}`,
              amount: (v.FinalRate * v.pax).toFixed(2),
              drCr: "dr",
            },
            {
              lineno: 2,
              ledgerName: "Domestic Base Fare",
              amount: (v.FinalRate * v.pax).toFixed(2),
              drCr: "cr",
            },
          ],
        }));
      };

      const pushToCloud = async (
        payload: any[],
        attempt = 1
      ): Promise<boolean> => {
        try {
          const res = await fetch("/api/cloud", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: payload }),
          });
          return res.ok;
        } catch {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            return pushToCloud(payload, attempt + 1);
          }
          return false;
        }
      };

      const batchSize = 50;
      const currentDate = new Date().toISOString().split("T")[0];

      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);
        const payload = prepareData(batch);

        if (!payload.length) continue;

        const success = await pushToCloud(payload);
        if (!success) {
          toast.error(`Error submitting batch ${i + 1} to cloud`);
          break;
        }

        toast.success(`Batch ${i / batchSize + 1} Vouchers Pushed!`);
      }

      const body = {
        region: "all",
        voucher_type: "sales",
        submission_date: currentDate,
        last_updated_date: selected.at(-1)?.InvoiceEntryDate?.split("T")[0],
        start_date: dateRange.start,
        end_date: dateRange.end,
        start_voucher: selected.at(0)?.InvoiceNo,
        end_voucher: selected.at(-1)?.InvoiceNo,
      };

      await fetch("/api/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to push to cloud");
    } finally {
      setPushing(false);
    }
  };
  

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
      {/* LEFT PANEL */}
      <Card className="border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50">
        <CardHeader>
          <CardTitle className="text-base font-medium text-blue-600">
            🔄 Last Sync Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 text-sm text-gray-700">
          {[
            {
              label: "Submission Date",
              value: formatDate(syncMeta?.submission_date),
              color: "text-green-600",
            },
            {
              label: "Last Updated Voucher",
              value: formatDate(syncMeta?.last_updated_date),
            },
            {
              label: "Voucher Range",
              value: `#${syncMeta?.start_voucher} → #${syncMeta?.end_voucher}`,
            },
            {
              label: "Date Range",
              value: `${formatDate(syncMeta?.start_date)} → ${formatDate(
                syncMeta?.end_date
              )}`,
            },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className={`text-xs font-medium text-gray-500`}>{label}</p>
              <p
                className={`text-base font-semibold  ${
                  color ? color : "text-black"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RIGHT PANEL */}
      <Card className="p-2 border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-700">
            Voucher Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
            />
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
            />
            <Button className="w-full" onClick={handleFetch} disabled={loading}>
              {loading ? "Fetching..." : "Fetch Sales Entries"}
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={handleExport}>
              Export to Excel
            </Button>
            <Button onClick={handlePushToCloud} disabled={pushing}>
              {pushing ? "Submitting..." : "Submit to Cloud"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* SUMMARY CARDS */}
      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Fetched */}
        <Card className="border border-blue-100 shadow-sm bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base text-blue-800">
              📦 Total Fetched
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-blue-700">
            {vouchers.length} Vouchers
          </CardContent>
        </Card>

        {/* Selected Count */}
        <Card className="border border-yellow-100 shadow-sm bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base text-yellow-800">
              ✅ Selected
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-yellow-700">
            {selectedInvoiceNos.length} Selected
          </CardContent>
        </Card>

        {/* Total Sum */}
        <Card className="border border-green-100 shadow-sm bg-green-50">
          <CardHeader>
            <CardTitle className="text-base text-green-800">
              💰 Total Value
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-green-700">
            ₹ {totalSum.toLocaleString("en-IN")}
          </CardContent>
        </Card>
      </div>

      {/* TABLE OUTPUT */}
      {vouchers.length > 0 && (
        <div className="md:col-span-2 mt-6">
          <VoucherList vouchers={vouchers} />
        </div>
      )}
    </div>
  );
}
