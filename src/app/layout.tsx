import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DiscoveryProvider } from "@/stores/discovery-store";
import { ProjectProvider } from "@/stores/project-store";
import { AuthProvider } from "@/stores/auth-context";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { CommandPalette } from "@/components/layout/command-palette";
import { ProjectBootstrap } from "@/components/layout/project-bootstrap";
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

// Display face for headings. Manrope's heavier weights have visible
// optical-tightness that Geist lacks — gives the type a second voice
// without leaving the sans family.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CORE Discovery",
  description: "AI-powered product discovery coaching — Capture, Orchestrate, Refine, Execute",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <ProjectProvider>
              <DiscoveryProvider>
                <ProjectBootstrap />
                <CommandPalette />
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
            </ProjectProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
