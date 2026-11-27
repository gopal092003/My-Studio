"use client";

import {
  BookOpen,
  MessageCircle,
  MousePointer2,
  Music,
  Paintbrush,
  PanelsTopLeft,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type CursorKind = "studio" | "art" | "craft" | "manga" | "stories" | "anime" | "poem" | "soundtrack" | "chatroom";

const cursorIcons: Partial<Record<CursorKind, LucideIcon>> = {
  studio: MousePointer2,
  art: Paintbrush,
  manga: PanelsTopLeft,
  stories: BookOpen,
  anime: Sparkles,
  poem: PenLine,
  soundtrack: Music,
  chatroom: MessageCircle,
};

function getCursorKind(pathname: string): CursorKind {
  if (pathname.startsWith("/art/chatroom")) return "chatroom";

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] === "admin" && segments[1] === "art" ? "art" : segments[0];
  switch (section) {
    case "art":
    case "craft":
    case "manga":
    case "stories":
    case "anime":
    case "poem":
    case "soundtrack":
      return section;
    default:
      return "studio";
  }
}

export function StudioCursor() {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const cursorKind = getCursorKind(pathname);
  const CursorIcon = cursorIcons[cursorKind] ?? MousePointer2;

  useEffect(() => {
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!pointerQuery.matches || motionQuery.matches) return;

    const root = document.documentElement;
    const cursor = cursorRef.current;
    if (!cursor) return;

    const resetCursor = () => {
      root.classList.remove("studio-cursor-enabled", "studio-cursor-native");
      cursor.classList.remove("is-visible", "is-targeted", "is-pressed");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !pointerQuery.matches || motionQuery.matches) {
        resetCursor();
        return;
      }
      root.classList.add("studio-cursor-enabled");
      const target = event.target instanceof Element ? event.target : null;
      const isEditable = Boolean(target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
      const isTargeted = Boolean(target?.closest("a, button, summary, [role='button']"));
      root.classList.toggle("studio-cursor-native", isEditable);
      cursor.classList.toggle("is-targeted", isTargeted && !isEditable);
      cursor.classList.toggle("is-visible", !isEditable);
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") cursor.classList.add("is-pressed");
    };
    const onPointerUp = () => cursor.classList.remove("is-pressed");
    const onPointerLeave = () => resetCursor();
    const onPreferenceChange = () => resetCursor();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("blur", onPointerLeave);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    pointerQuery.addEventListener("change", onPreferenceChange);
    motionQuery.addEventListener("change", onPreferenceChange);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onPointerLeave);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      pointerQuery.removeEventListener("change", onPreferenceChange);
      motionQuery.removeEventListener("change", onPreferenceChange);
      resetCursor();
    };
  }, []);

  return (
    <span aria-hidden="true" className="studio-cursor" data-cursor-kind={cursorKind} ref={cursorRef}>
      {cursorKind === "craft" ? <CraftNeedleIcon /> : <CursorIcon size={17} strokeWidth={1.8} />}
    </span>
  );
}

function CraftNeedleIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
      <path d="m5.5 18.5 12-12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <ellipse cx="18.7" cy="5.3" rx="2" ry="1.1" stroke="currentColor" strokeWidth="1.6" transform="rotate(-45 18.7 5.3)" />
      <path d="M20 4c1.6-1.5 3.1-1.1 2.5.2-.4.8-1.5 1.1-2 2-.6 1-.2 2 .5 2.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}
