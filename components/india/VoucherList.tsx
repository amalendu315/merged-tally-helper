"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoucherSelection } from "@/context/VoucherSelectionContext";

interface VoucherListProps {
  vouchers: any[];
}

export default function VoucherList({ vouchers }: VoucherListProps) {
  const [selectAll, setSelectAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [vouchersPerPage] = useState<number>(50);
  const { selectedInvoiceNos, setSelectedInvoiceNos } = useVoucherSelection();

  const [filterInvoice, setFilterInvoice] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [filterCountry, setFilterCountry] = useState<string>("All");
  const [filterPnr, setFilterPnr] = useState<string>("");

  const indexOfLastVoucher = currentPage * vouchersPerPage;
  const indexOfFirstVoucher = indexOfLastVoucher - vouchersPerPage;

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      const countryLower = voucher.Country?.toLowerCase() || "";
      const stateLower = voucher.State?.toLowerCase() || "";
      const cityLower = voucher.CityName?.toLowerCase() || "";
      const countryMainLower = voucher.CountryMain?.toLowerCase() || "";
      const countryID = voucher.CountryID;
      const countryMainID = voucher.CityEntryMainID;

      if (countryID === 4) voucher.Country = "Nepal";
      if (!voucher.Country && countryMainLower === "india")
        voucher.Country = "India";

      const isIndia =
        countryLower === "india" ||
        countryMainLower === "india" ||
        countryID === 1 ||
        countryMainID === 1 ||
        (!countryLower && countryMainLower === "india");

      const isNepal =
        countryLower === "nepal" ||
        countryMainLower === "nepal" ||
        countryID === 4 ||
        stateLower.includes("Province");

      const isOther =
        (!countryLower &&
          !countryID &&
          !countryMainLower &&
          !stateLower &&
          !cityLower) ||
        (!voucher.Country &&
          !voucher.CountryID &&
          !voucher.CountryMain &&
          !voucher.CityEntryMainID &&
          !voucher.State &&
          !voucher.CityName);

      const matchesCountry =
        filterCountry === "All" ||
        (filterCountry === "India" && isIndia) ||
        (filterCountry === "Nepal" && isNepal) ||
        (filterCountry === "Other" && isOther);

      const matchesInvoiceNumber =
        filterInvoice === null || Number(voucher.InvoiceNo) === filterInvoice;

      const matchesDate =
        !filterDate || isSameDay(parseISO(voucher.SaleEntryDate), filterDate);

      const matchesPnr =
        filterPnr === "" ||
        voucher.Pnr?.toLowerCase().includes(filterPnr.toLowerCase());

      return (
        matchesCountry && matchesInvoiceNumber && matchesDate && matchesPnr
      );
    });
  }, [vouchers, filterCountry, filterInvoice, filterDate, filterPnr]);

  const currentVouchers = useMemo(() => {
    return filteredVouchers.slice(indexOfFirstVoucher, indexOfLastVoucher);
  }, [filteredVouchers, indexOfFirstVoucher, indexOfLastVoucher]);

  const handleCheckboxChange = (invoiceID: number) => {
    const updated = selectedInvoiceNos.includes(invoiceID)
      ? selectedInvoiceNos.filter((id) => id !== invoiceID)
      : [...selectedInvoiceNos, invoiceID];
    setSelectedInvoiceNos(updated);
  };

  const handleSelectAllChange = () => {
    if (!selectAll) {
      const all = filteredVouchers.map((v) => v.InvoiceNo);
      setSelectedInvoiceNos(all);
    } else {
      setSelectedInvoiceNos([]);
    }
    setSelectAll(!selectAll);
  };

  useEffect(() => {
    setSelectAll(
      filteredVouchers.length > 0 &&
        filteredVouchers.every((v) => selectedInvoiceNos.includes(v.InvoiceNo))
    );
  }, [filteredVouchers, selectedInvoiceNos]);

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Input
          type="number"
          placeholder="Invoice No"
          value={filterInvoice ?? ""}
          onChange={(e) =>
            setFilterInvoice(e.target.value ? +e.target.value : null)
          }
          className="w-40"
        />
        <DatePicker
          selected={filterDate}
          onChange={(date) => setFilterDate(date)}
          dateFormat="yyyy-MM-dd"
          placeholderText="Sale Entry Date"
          className="border rounded p-2 text-sm w-44"
        />
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="border rounded p-2 text-sm"
        >
          <option value="All">All Countries</option>
          <option value="India">India</option>
          <option value="Nepal">Nepal</option>
          <option value="Other">Other</option>
        </select>
        <Input
          placeholder="Filter by PNR"
          value={filterPnr}
          onChange={(e) => setFilterPnr(e.target.value)}
          className="w-44"
        />
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAllChange}
                />
              </TableHead>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Invoice No</TableHead>
              <TableHead>Sale ID</TableHead>
              <TableHead>Invoice Entry Date</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>PNR</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Pax Qty</TableHead>
              <TableHead>Total Rate</TableHead>
              <TableHead>Sale Entry Date</TableHead>
              <TableHead>Types</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentVouchers.map((voucher) => (
              <TableRow key={voucher.InvoiceID}>
                <TableCell>
                  <Checkbox
                    checked={selectedInvoiceNos.includes(voucher.InvoiceNo)}
                    onCheckedChange={() =>
                      handleCheckboxChange(voucher.InvoiceNo)
                    }
                  />
                </TableCell>
                <TableCell>{voucher.InvoiceID}</TableCell>
                <TableCell>{voucher.InvoiceNo}</TableCell>
                <TableCell>{voucher.SaleID}</TableCell>
                <TableCell>
                  {format(
                    parseISO(voucher.InvoiceEntryDate),
                    "MM/dd/yyyy HH:mm:ss"
                  )}
                </TableCell>
                <TableCell>
                  {voucher.Country
                    ? `${voucher.CityName}, ${voucher.Country}`
                    : voucher.CityName}
                </TableCell>
                <TableCell>{voucher.Pnr}</TableCell>
                <TableCell>{voucher.AccountName}</TableCell>
                <TableCell>{voucher.pax}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                  }).format(voucher.FinalRate * voucher.pax)}
                </TableCell>
                <TableCell>
                  {format(
                    parseISO(voucher.SaleEntryDate),
                    "MM/dd/yyyy HH:mm:ss"
                  )}
                </TableCell>
                <TableCell>{voucher.Types}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-center mt-4 gap-2">
        <Button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          variant="outline"
          size="sm"
        >
          Previous
        </Button>
        <span className="text-sm text-gray-500">
          Page {currentPage} of{" "}
          {Math.ceil(filteredVouchers.length / vouchersPerPage)}
        </span>
        <Button
          onClick={() =>
            setCurrentPage((prev) =>
              indexOfLastVoucher < filteredVouchers.length ? prev + 1 : prev
            )
          }
          disabled={indexOfLastVoucher >= filteredVouchers.length}
          variant="outline"
          size="sm"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
