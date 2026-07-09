import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WOD Victims",
  description:
    "A names-first memorial map and timeline of documented victims of the Philippine drug war."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
