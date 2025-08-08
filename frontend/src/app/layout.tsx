import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consulting Toolkit",
  description: "Modern consulting toolkit for analysis and planning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full bg-white dark:bg-black text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <NavBar />
          <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-8">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
