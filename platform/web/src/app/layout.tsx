import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevPod Platform",
  description: "PR review and feature documentation dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex">
        <QueryProvider>
          <ThemeProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
