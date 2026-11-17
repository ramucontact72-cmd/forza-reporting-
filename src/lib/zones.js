export const TIME_ZONES = [
  { value: "America/New_York", label: "New York" },
  { value: "UTC", label: "UTC" },
  { value: "America/Los_Angeles", label: "Pacific" },
];

export function normalizeZone(value) {
  return TIME_ZONES.some((zone) => zone.value === value) ? value : "America/New_York";
}
