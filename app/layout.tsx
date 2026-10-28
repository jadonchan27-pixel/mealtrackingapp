import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Tracking App",
  description: "Calorie tracking and weekly meal planning",
  appleWebApp: {
    capable: true,
    title: "Meal Tracker",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f7d4f",
  // Lets the layout extend under the phone's notch and home bar (see safe-area padding in globals.css).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
