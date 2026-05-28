import Link from "next/link";

const realms = [
  {
    title: "The Artisan Sphere",
    description: "Paintings, sketches, and visual artistry.",
    href: "/artisan",
    gradient: "from-orange-500/20 to-yellow-500/20",
    border: "border-orange-400/30",
    glow: "group-hover:shadow-orange-500/20",
  },
  {
    title: "The Verse Sanctuary",
    description: "Poetry, emotions, and lyrical expression.",
    href: "/verse",
    gradient: "from-violet-500/20 to-purple-700/20",
    border: "border-violet-400/30",
    glow: "group-hover:shadow-violet-500/20",
  },
  {
    title: "The Otaku Dimension",
    description: "Anime culture, fandoms, and imagination.",
    href: "/otaku",
    gradient: "from-cyan-500/20 to-blue-700/20",
    border: "border-cyan-400/30",
    glow: "group-hover:shadow-cyan-500/20",
  },
  {
    title: "The Literary Dominion",
    description: "Novels, stories, and immersive worlds.",
    href: "/literary",
    gradient: "from-amber-500/20 to-red-700/20",
    border: "border-amber-400/30",
    glow: "group-hover:shadow-amber-500/20",
  },
  {
    title: "The Manga Nexus",
    description: "Manga panels, arcs, and legendary journeys.",
    href: "/manga",
    gradient: "from-zinc-500/20 to-neutral-700/20",
    border: "border-zinc-400/30",
    glow: "group-hover:shadow-zinc-500/20",
  },
  {
    title: "The Creative Realm",
    description: "Crafts, creativity, and handmade expression.",
    href: "/creative",
    gradient: "from-pink-500/20 to-rose-700/20",
    border: "border-pink-400/30",
    glow: "group-hover:shadow-pink-500/20",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />

      <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <h1 className="text-2xl font-bold tracking-[0.3em]">
          GG STUDIOS
        </h1>

        <nav className="hidden gap-8 text-sm text-zinc-300 md:flex">
          <Link href="#realms" className="transition hover:text-white">
            Realms
          </Link>

          <Link href="/about" className="transition hover:text-white">
            About
          </Link>

          <Link href="/contact" className="transition hover:text-white">
            Contact
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.4em] text-zinc-400">
          Welcome To
        </p>

        <h2 className="max-w-5xl text-5xl font-black leading-tight md:text-7xl">
          A Multiverse Of
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            {" "}
            Creativity
          </span>
        </h2>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
          Step into worlds forged from imagination — art, poetry, anime,
          literature, manga, and handcrafted creativity united under one realm.
        </p>

        <Link
          href="#realms"
          className="mt-10 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-medium backdrop-blur-md transition hover:border-white/40 hover:bg-white/20"
        >
          Enter The Realms
        </Link>
      </section>

      {/* Realm Grid */}
      <section
        id="realms"
        className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-2 xl:grid-cols-3"
      >
        {realms.map((realm) => (
          <Link
            key={realm.title}
            href={realm.href}
            className={`group relative overflow-hidden rounded-3xl border ${realm.border} bg-gradient-to-br ${realm.gradient} p-8 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:shadow-2xl ${realm.glow}`}
          >
            <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <h3 className="text-2xl font-bold tracking-wide">
                {realm.title}
              </h3>

              <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                {realm.description}
              </p>

              <div className="mt-8 flex items-center text-sm font-medium text-white/80 transition group-hover:text-white">
                Explore Realm
                <span className="ml-2 transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-8 text-center text-sm text-zinc-500">
        © 2026 GG Studios. Creating worlds beyond imagination.
      </footer>
    </main>
  );
}