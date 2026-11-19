const PERIODS = ["today", "last7days", "last30days", "thisMonth"];
const INTERVALS = ["daily", "weekly", "monthly"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getAnalyticsFilterError(filters) {
  if (!INTERVALS.includes(filters.interval)) {
    return "Choose a valid chart interval.";
  }

  if (filters.period === "custom") {
    if (!filters.startDate || !filters.endDate) {
      return "Choose both a start date and an end date.";
    }
    if (!isValidDate(filters.startDate) || !isValidDate(filters.endDate)) {
      return "Enter valid dates in YYYY-MM-DD format.";
    }
    if (filters.startDate > filters.endDate) {
      return "The start date must be on or before the end date.";
    }
    return null;
  }

  if (!PERIODS.includes(filters.period)) {
    return "Choose a valid date range.";
  }
  return null;
}

export function buildAnalyticsQuery(filters) {
  const error = getAnalyticsFilterError(filters);
  if (error) throw new Error(error);

  const params = new URLSearchParams();
  if (filters.period === "custom") {
    params.set("startDate", filters.startDate);
    params.set("endDate", filters.endDate);
  } else {
    params.set("period", filters.period);
  }
  params.set("interval", filters.interval);
  return params.toString();
}
