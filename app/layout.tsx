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
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("hisab-theme")||"dark";var d=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="dark";}})()`,
          }}
        />
        <AppProvider>
          {children}
          <TabBar />
          <SWRegister />
        </AppProvider>
      </body>
    </html>
  );
}
