"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface VoucherSelectionContextType {
  selectedInvoiceNos: number[];
  setSelectedInvoiceNos: (ids: number[]) => void;
  totalSum: number;
  setTotalSum: (amount: number) => void;
}

const VoucherSelectionContext = createContext<
  VoucherSelectionContextType | undefined
>(undefined);

export function VoucherSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<number[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);

  return (
    <VoucherSelectionContext.Provider
      value={{
        selectedInvoiceNos,
        setSelectedInvoiceNos,
        totalSum,
        setTotalSum,
      }}
    >
      {children}
    </VoucherSelectionContext.Provider>
  );
}

export function useVoucherSelection() {
  const context = useContext(VoucherSelectionContext);
  if (!context) {
    throw new Error(
      "useVoucherSelection must be used within a VoucherSelectionProvider"
    );
  }
  return context;
}
