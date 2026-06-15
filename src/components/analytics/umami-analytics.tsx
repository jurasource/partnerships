import Script from "next/script";

export function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const domain = process.env.NEXT_PUBLIC_DOMAIN;

  if (!websiteId) return null;

  return (
    <Script
      src="https://magnet.jurarunner.com/u.js"
      strategy="afterInteractive"
      data-website-id={websiteId}
      data-domains={domain}
      data-host-url="https://magnet.jurarunner.com"
    />
  );
}
