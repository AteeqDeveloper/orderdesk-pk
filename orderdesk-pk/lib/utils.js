/**
 * Small, dependency-free helpers shared across the app.
 * Keep this file simple — add to it as real needs come up.
 */

export function formatPKR(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
