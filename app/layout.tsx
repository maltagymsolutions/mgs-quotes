import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: "MGS Workspace",
  description: "Malta Gym Solutions operations workspace",
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
      <head>
        <Script id="remove-extension-html-attributes" strategy="beforeInteractive">
          {`
            for (const attribute of Array.from(document.documentElement.attributes)) {
              if (
                attribute.name.startsWith("data-__host_prefix_") &&
                attribute.name.endsWith("-filters-channel")
              ) {
                document.documentElement.removeAttribute(attribute.name);
              }
            }
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
