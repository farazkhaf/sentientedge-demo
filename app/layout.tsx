import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./intelligence.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./mobile.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SentientEdge - Miami Neighborhood Intelligence",
  description:
    "A Miami urban intelligence workspace. Explore neighborhood profiles, geographic layers, connected briefings, and area comparisons.",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
