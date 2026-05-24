import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LottoMax Enterprise",
  description: "CIAM onboarding and real-money wallet flows"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
