"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

const navLinks = [
  {
    label: "Realms",
    href: "#realms",
  },
  {
    label: "About",
    href: "/about",
  },
  {
    label: "Contact",
    href: "/contact",
  },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-black tracking-[0.3em] text-white"
        >
          GG STUDIOS
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-zinc-300 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="#realms"
            className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/20"
          >
            Explore
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-zinc-300 transition hover:text-white md:hidden"
        >
          <Menu size={26} />
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="border-t border-white/10 bg-black/90 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="border-b border-white/5 py-4 text-sm font-medium text-zinc-300 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="#realms"
              onClick={() => setIsOpen(false)}
              className="mt-4 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-medium text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/20"
            >
              Explore Realms
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}