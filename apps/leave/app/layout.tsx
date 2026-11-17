import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staff Portal | SSS Auto Parts",
  description: "SSS Parts staff leave portal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
