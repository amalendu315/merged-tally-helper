import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isNepalVoucher = (voucher: any) => {
  const country = voucher.Country?.toLowerCase() || "";
  const countryMain = voucher.CountryMain?.toLowerCase() || "";
  const state = voucher.State?.toLowerCase() || "";

  return (
    country === "nepal" ||
    countryMain === "nepal" ||
    voucher.CountryID === 4 ||
    state.includes("province")
  );
};

