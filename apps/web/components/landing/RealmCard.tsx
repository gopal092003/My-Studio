"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Realm = {
  title: string;
  description: string;
  href: string;
  gradient: string;
  border: string;
  glow: string;
};

interface RealmCardProps {
  realm: Realm;
}

export default function RealmCard({ realm }: RealmCardProps) {
  return (
    <Link
      href={realm.href}
      className={`
        group relative overflow-hidden rounded-3xl border
        ${realm.border}
        bg-gradient-to-br ${realm.gradient}
        p-8 backdrop-blur-xl
        transition-all duration-500
        hover:-translate-y-2
        hover:shadow-2xl
        ${realm.glow}
      `}
    >
      {/* Hover Glow */}
      <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Realm Title */}
        <h3 className="text-2xl font-bold tracking-wide text-white">
          {realm.title}
        </h3>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          {realm.description}
        </p>

        {/* Bottom CTA */}
        <div className="mt-8 flex items-center gap-2 text-sm font-medium text-white/80 transition group-hover:text-white">
          <span>Explore Realm</span>

          <ArrowRight
            size={18}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </div>
      </div>

      {/* Border Glow */}
      <div className="absolute inset-0 rounded-3xl border border-white/5" />
    </Link>
  );
}