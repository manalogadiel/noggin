const BACK_ON_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const ROOM_CHIP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function isNogResting(
  restUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!restUntil) {
    return false;
  }
  const timestamp = Date.parse(restUntil);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function formatRestBackOnDate(restUntil: string): string {
  const date = new Date(restUntil);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return BACK_ON_FORMATTER.format(date);
}

export function formatRoomRestDate(restUntil: string): string {
  const date = new Date(restUntil);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return ROOM_CHIP_FORMATTER.format(date);
}
