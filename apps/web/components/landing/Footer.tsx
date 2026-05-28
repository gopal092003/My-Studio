"use client";

import Link from "next/link";

const realms = [
  {
    name: "Artisan Sphere",
    href: "/artisan",
  },
  {
    name: "Verse Sanctuary",
    href: "/verse",
  },
  {
    name: "Otaku Dimension",
    href: "/otaku",
  },
  {
    name: "Literary Dominion",
    href: "/literary",
  },
  {
    name: "Manga Nexus",
    href: "/manga",
  },
  {
    name: "Creative Realm",
    href: "/creative",
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-3">
        {/* Brand */}
        <div>
          <h2 className="text-2xl font-black tracking-[0.3em] text-white">
            GG STUDIOS
          </h2>

          <p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
            A creative multiverse where art, poetry, anime, manga,
            storytelling, and craftsmanship converge into infinite worlds of
            imagination.
          </p>
        </div>

        {/* Realms */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-300">
            Realms
          </h3>

          <div className="mt-5 flex flex-col gap-3">
            {realms.map((realm) => (
              <Link
                key={realm.name}
                href={realm.href}
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                {realm.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-300">
            Navigation
          </h3>

          <div className="mt-5 flex flex-col gap-3">
            <Link
              href="/about"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              About
            </Link>

            <Link
              href="/contact"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              Contact
            </Link>

            <Link
              href="#realms"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              Explore Realms
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/10 px-6 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} GG Studios. Creating worlds beyond
        imagination.
      </div>
    </footer>
  );
}