"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="animate-float absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="animate-float absolute bottom-10 left-10 h-60 w-60 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="animate-float absolute right-10 top-40 h-60 w-60 rounded-full bg-pink-500/10 blur-3xl" />
      </div>

      {/* Tag */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-4 text-xs uppercase tracking-[0.5em] text-zinc-400 md:text-sm"
      >
        Welcome To GG Studios
      </motion.p>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-6xl text-5xl font-black leading-tight md:text-7xl xl:text-8xl"
      >
        Enter A Universe Of
        <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          {" "}
          Infinite Creativity
        </span>
      </motion.h1>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="mt-8 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg"
      >
        Explore worlds shaped through art, poetry, anime, manga,
        storytelling, and handcrafted imagination — all connected under one
        creative multiverse.
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-4"
      >
        <Link
          href="#realms"
          className="rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/40 hover:bg-white/20"
        >
          Enter The Realms
        </Link>

        <Link
          href="/about"
          className="rounded-full border border-zinc-700 px-8 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Learn More
        </Link>
      </motion.div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}