import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DiscoveryProvider } from "@/stores/discovery-store";
import { AppSidebar } from "@/components/layout/app-sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CORE Discovery",
  description: "AI-powered product discovery coaching — Capture, Orient, Refine, Execute",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DiscoveryProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </SidebarProvider>
          </TooltipProvider>
        </DiscoveryProvider>
      </body>
    </html>
  );
}
