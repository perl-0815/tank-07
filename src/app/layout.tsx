import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "水槽07 — ABYSSAL-7 EMERGENCY LINK";
const description = "海底研究施設から届いた、ユナの救難通信。回線が途絶えるまでの3分を繰り返し、記憶と言葉で真相に迫るチャットADV。";

async function metadataBase(): Promise<URL> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (deploymentHost) return new URL(`https://${deploymentHost}`);

  // Self-hosted installations can share their actual origin without a fixed domain.
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3007").split(",")[0].trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ? "http" : "https";
  return new URL(`${protocol}://${host}`);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: await metadataBase(),
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "水槽07",
      locale: "ja_JP",
      type: "website",
    },
    // Next.js also uses opengraph-image.png for this card's image.
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080f14",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
