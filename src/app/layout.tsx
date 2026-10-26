import AuthCacheReset from "@/components/auth-cache-reset";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { CacheProvider } from "@/components/cache-provider";
import { ToastProvider } from "@/components/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hynox Campus - Professional Learning Bridge",
  description: "An educational portal bridging physical classroom instruction with digital hands-on labs, automated assignment validation, and industry-grade placements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <CacheProvider>
            <AuthCacheReset>
              <ToastProvider>{children}</ToastProvider>
            </AuthCacheReset>
          </CacheProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
