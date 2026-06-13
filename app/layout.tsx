import "./globals.css";
import type { Metadata } from "next";
import { Schibsted_Grotesk, Big_Shoulders_Inline, Manrope, Martian_Mono } from "next/font/google";
import { Providers } from "./providers";
import { TopBar } from "@/components/TopBar";

const head = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-head" });
const display = Big_Shoulders_Inline({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CertaFrame — Verified work, judged by AI consensus",
  description: "GenLayer-native multimodal performance proof protocol.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <TopBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
