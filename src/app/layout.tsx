import type { Metadata, Viewport } from "next";
import { DM_Sans, Lora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", weight: ["400", "500", "600"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SPACIO — Find your space on campus", template: "%s · SPACIO" },
  description:
    "Find, reserve and check in to campus study spaces, the library and the gym at SRM. A student project — not an official SRM service.",
  applicationName: "SPACIO",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f0e4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${lora.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-[12px] !border-line !bg-surface !text-ink !shadow-pop !font-sans",
              description: "!text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
