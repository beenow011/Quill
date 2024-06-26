import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utility";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import 'react-loading-skeleton/dist/skeleton.css'
import 'simplebar-react/dist/simplebar.min.css'
import { Toaster } from "@/components/ui/toaster";
import { constructMetadata } from "@/lib/utils";
import { EdgeStoreProvider } from "@/lib/edgestore";
const inter = Inter({ subsets: ["latin"] });

export const metadat = constructMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <Providers>
        <body className={cn('min-h-screen font-sans antialiased grainy', inter.className)}>
          <Toaster />
          <Navbar />
          <EdgeStoreProvider>{children}</EdgeStoreProvider></body>
      </Providers>
    </html>
  );
}
