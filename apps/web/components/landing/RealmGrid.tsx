"use client";

import { motion } from "framer-motion";
import RealmCard from "./RealmCard";

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

export default function RealmGrid() {
  return (
    <section
      id="realms"
      className="relative z-10 mx-auto max-w-7xl px-6 pb-28"
    >
      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        viewport={{ once: true }}
        className="mb-14 text-center"
      >
        <p className="mb-3 text-sm uppercase tracking-[0.4em] text-zinc-500">
          Choose Your Realm
        </p>

        <h2 className="text-4xl font-black md:text-5xl">
          Six Worlds.
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            {" "}
            Infinite Stories.
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
          Every realm within GG Studios represents a different dimension of
          creativity waiting to be explored.
        </p>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {realms.map((realm, index) => (
          <motion.div
            key={realm.title}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: index * 0.08,
            }}
            viewport={{ once: true }}
          >
            <RealmCard realm={realm} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}