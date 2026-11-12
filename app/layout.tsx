import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { Suspense } from "react";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import NavAccount from "@/components/NavAccount";
import { NavAccountPlaceholder } from "@/components/NavAccountLinks";
import ScrollToTop from "@/components/ScrollToTop";
import { iphoneViewportScript } from "@/lib/iphoneViewport";
import { sfwInitScript } from "@/lib/sfw";
import {
  SITE_NAME,
  SITE_PREVIEW_IMAGE,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import { themeInitScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE || undefined,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [SITE_PREVIEW_IMAGE],
  },
  twitter: { card: "summary", images: [SITE_PREVIEW_IMAGE] },
  icons: {
    icon: [
      { url: "/logo-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/logo-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: injects the app's own constant theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: injects the app's own constant SFW mode script */}
        <script dangerouslySetInnerHTML={{ __html: sfwInitScript }} />
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: injects the app's own constant viewport script */}
        <script dangerouslySetInnerHTML={{ __html: iphoneViewportScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav
          account={
            <Suspense fallback={<NavAccountPlaceholder />}>
              <NavAccount />
            </Suspense>
          }
        />
        {children}
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  );
}
