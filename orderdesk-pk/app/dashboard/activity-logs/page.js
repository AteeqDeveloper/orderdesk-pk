import ActivityLogList from "@/components/activity/ActivityLogList";

export const metadata = {
  title: "Activity Logs — OrderDesk PK",
};

export default function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Activity logs</h1>
        <p className="mt-1 text-sm text-ink-500">
          A record of successful changes made in your account.
        </p>
      </div>
      <ActivityLogList />
    </div>
  );
}
