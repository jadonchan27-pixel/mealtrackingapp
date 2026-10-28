import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Tracking App",
  description: "Calorie tracking and weekly meal planning",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
