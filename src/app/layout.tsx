import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UmamiAnalytics } from "@/components/analytics/umami-analytics";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Partnerships",
  description:
    "Research and compare firms for UK civil nuclear consortium planning.",
  icons: {
    icon: [
      { url: "/icons8-network-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons8-network-64.png", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/icons8-network-64.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <UmamiAnalytics />
      </body>
    </html>
  );
}
