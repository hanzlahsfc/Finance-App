import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { TabBar } from "@/components/TabBar";
import { SWRegister } from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Hisab",
  description: "Personal finance, weekly pay & shared expenses with friends",
  applicationName: "Hisab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hisab",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
          <TabBar />
          <SWRegister />
        </AppProvider>
      </body>
    </html>
  );
}
