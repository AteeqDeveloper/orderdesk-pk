import { Suspense } from "react";
import AnalyticsReports from "@/components/reports/AnalyticsReports";

export const metadata = {
  title: "Reports & Analytics — OrderDesk PK",
  description:
    "Business insights, revenue summaries, order performance, and inventory analytics.",
};

function ReportsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading reports" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded bg-ink-100" />
      <div className="h-20 animate-pulse rounded-xl bg-ink-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-ink-100"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-ink-100" />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <AnalyticsReports />
    </Suspense>
  );
}
