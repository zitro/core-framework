import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DiscoveryProvider } from "@/stores/discovery-store";
import { AuthProvider } from "@/stores/auth-context";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import "./globals.css";
import "highlight.js/styles/github-dark.min.css";

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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <DiscoveryProvider>
              <TooltipProvider>
                <SidebarProvider>
                  <AppSidebar />
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <AppHeader />
                    <main className="flex-1 overflow-auto">
                      {children}
                    </main>
                  </div>
                </SidebarProvider>
              </TooltipProvider>
              <Toaster richColors position="bottom-right" />
            </DiscoveryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
