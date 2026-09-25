import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Voting Kampus",
  description: "Pemilihan organisasi kampus: satu mahasiswa satu suara, suara rahasia, hasil realtime, audit trail terverifikasi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
