"use client";

import { useEffect, useMemo } from "react";
import { StudioMuseumAboutGallery } from "@/components/studio/museum-about-gallery";
import { StudioMuseumEnvironment } from "@/components/studio/museum-environment";
import { createMarbleMaps } from "@/lib/studio-museum/textures";

export function StudioMuseumScene() {
  const marbleMaps = useMemo(createMarbleMaps, []);

  useEffect(() => () => {
    marbleMaps?.map.dispose();
    marbleMaps?.bumpMap.dispose();
  }, [marbleMaps]);

  return (
    <>
      <StudioMuseumEnvironment marbleMaps={marbleMaps} />
      <StudioMuseumAboutGallery marbleMap={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} />
    </>
  );
}
