import type { Metadata } from "next";
import { BackgroundNetwork } from "@/components/background-network";
import { StudioCursor } from "@/components/studio-cursor";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Studio Universe",
    template: "%s · Studio Universe",
  },
  description: "A living studio universe of stories, art, and creative worlds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <BackgroundNetwork />
        <StudioCursor />
        {children}
      </body>
    </html>
  );
}
