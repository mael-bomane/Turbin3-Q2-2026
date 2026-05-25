import { Inconsolata } from "next/font/google";
import { Viewport } from "next";
import ClientLayout from "@/components/LayoutClient";
import config from "@/config";
import { getSEOTags, renderSchemaTags } from "@/lib/seo";
import "katex/dist/katex.min.css";
import "./globals.css";

import type { ReactNode } from "react";

const font = Inconsolata({ subsets: ["latin"], weight: "variable" });

export const viewport: Viewport = {
  // Will use the primary color of your theme to show a nice theme color in the URL bar of supported browsers
  themeColor: config.colors.main,
  width: "device-width",
  initialScale: 1,
};

export const metadata = getSEOTags({
  title: config.appName,
  description: config.appDescription,
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={config.colors.theme}
      className={font.className}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col bg-secondary dark:bg-background">
        {renderSchemaTags()}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
