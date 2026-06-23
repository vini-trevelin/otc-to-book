import type { Metadata } from "next";
import { Oxanium } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "OTC-to-Book",
  description: "Realtime OTC quote extraction and market book workstation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans", oxanium.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
