import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OnHand Helper - Shopify Inventory CSV Tool",
  description: "Generate a safe Shopify Inventory CSV import in minutes. Match your supplier feed to Shopify inventory with validation and mismatch reports.",
  keywords: ["Shopify", "inventory", "CSV", "import", "supplier", "stock", "reconciliation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
