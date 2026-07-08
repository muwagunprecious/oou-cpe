import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CPE Smart Academic Portal | OOU Computer Engineering",
  description:
    "The official smart academic portal for the Department of Computer Engineering, Olabisi Onabanjo University. Manage schedules, attendance, assignments, and more.",
  keywords: ["OOU", "Computer Engineering", "Academic Portal", "SIWES", "Attendance"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
