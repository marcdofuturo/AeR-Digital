import type { BillingRole } from "@ar/shared";

export function billingRoleLabel(role: BillingRole | string) {
  if (role === "principal") return "Principal";
  if (role === "primary") return "Primario";
  return "Featuring";
}

export function billingRoleClasses(role: BillingRole | string) {
  if (role === "principal") {
    return "border-emerald-700 bg-emerald-600 text-white";
  }
  if (role === "primary") {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200";
  }
  return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200";
}
