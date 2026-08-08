import type { DeviceType } from "@prisma/client";

export type DeviceInfo = {
  deviceType: DeviceType;
  browser: string;
  os: string;
};

/**
 * A deliberately small user-agent parser. It only needs to answer the questions
 * the metrics dashboard asks — phone vs computer, which browser, which OS — so
 * it avoids pulling in a heavyweight UA database.
 */
export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  if (!ua) return { deviceType: "UNKNOWN", browser: "Unknown", os: "Unknown" };

  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);
  const isMobile = !isTablet && /Mobi|Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua);
  const deviceType: DeviceType = isTablet ? "TABLET" : isMobile ? "MOBILE" : "DESKTOP";

  // Order matters: several browsers embed "Chrome" or "Safari" in their UA.
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /SamsungBrowser/i.test(ua)
        ? "Samsung Internet"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Chrome\//i.test(ua)
            ? "Chrome"
            : /Safari\//i.test(ua)
              ? "Safari"
              : "Other";

  const os = /Windows NT/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /CrOS/i.test(ua)
            ? "ChromeOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Other";

  return { deviceType, browser, os };
}

/** Best-effort client IP from the proxy headers our hosts set. */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}
