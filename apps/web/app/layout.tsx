import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GG Studios",
  description:
    "A multiverse of creativity — art, poetry, anime, literature, manga, and handcrafted imagination.",
  keywords: [
    "GG Studios",
    "Art",
    "Poetry",
    "Anime",
    "Manga",
    "Literature",
    "Creative Platform",
  ],
  authors: [{ name: "GG Studios" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}