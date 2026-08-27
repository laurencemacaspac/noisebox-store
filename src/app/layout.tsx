import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Noisebox Store",
  description: "Independent music, apparel, posters, and design.",

  /*
   * DEMO / PRE-LAUNCH
   *
   * Prevent search engines from indexing
   * or following links on the site.
   *
   * Remove this when Noisebox is ready
   * for public launch.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}