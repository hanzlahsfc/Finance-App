import type { SVGProps } from "react";

// SF Symbols-style stroke icons.
const PATHS: Record<string, string> = {
  house: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  plus: "M12 5v14M5 12h14",
  people: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.74",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5-3a7.5 7.5 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a7.5 7.5 0 0 1-2 1.2L14.5 21h-5l-.5-2.6a7.5 7.5 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6a7.6 7.6 0 0 1 0-2.4l-2-1.6 2-3.4 2.4 1a7.5 7.5 0 0 1 2-1.2L9.5 3h5l.5 2.6a7.5 7.5 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2Z",
  chevronRight: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  chevronDown: "m6 9 6 6 6-6",
  x: "M6 6l12 12M18 6 6 18",
  check: "m4.5 12.5 5 5 10-11",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7m4 4v6m4-6v6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.5-4.5",
  wallet: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Zm13 6.5h.01",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2Zm3 6h6m-6 4h6m-6 4h4",
  userPlus: "M15 19v-1a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v1M8 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6m3-3h-6",
  crown: "M3 17l-1-9 5.5 4L12 5l4.5 7L22 8l-1 9Zm0 2h18",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  sync: "M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6",
  wifiOff: "M1 9c6-5 16-5 22 0M5 13c4-3.3 10-3.3 14 0M9 17c1.7-1.4 4.3-1.4 6 0M12 21h.01M3 3l18 18",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9m-4.3 13a2 2 0 0 1-3.4 0",
  minus: "M5 12h14",
  calendar: "M8 2v4m8-4v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  pencil: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
  send: "m22 2-7 20-4-9-9-4Zm0 0L11 13",
  coins: "M12 8c-2.2 0-4 1-4 2.5S9.8 13 12 13s4 1 4 2.5S14.2 18 12 18m0-10c1.7 0 3.1.6 3.8 1.5M12 18c-1.7 0-3.1-.6-3.8-1.5M12 8V6m0 12v2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.7 0-3.4 1-4.5 2.5C11.9 5 10.2 4 8.5 4A4.5 4.5 0 0 0 4 8.5c0 2.3 1.5 4 3 5.5l5 6Z",
  dumbbell: "M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10",
  apple: "M12 7.5c-1.5-2-4-2.5-5.5-1C4.5 8 5 12 7 15c1.5 2.3 2.5 3 3.5 2.5.7-.3 1.3-.5 1.5-.5s.8.2 1.5.5c1 .5 2-.2 3.5-2.5 2-3 2.5-7 .5-9-1.5-1.5-4-1-5.5 1Zm0 0c0-2 1-3.5 3-4",
};

export const ICON_NAMES = new Set(Object.keys(PATHS));
export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  ...props
}: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
