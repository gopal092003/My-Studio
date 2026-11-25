"use client";

import { useRef, useState } from "react";

export type ArtworkGalleryImage = {
  id: string;
  src: string;
  alt: string;
};

export function ArtworkGallery({ images }: { images: ArtworkGalleryImage[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedImage = images[selectedIndex];

  if (!selectedImage) return <div className="art-detail-image art-detail-image-empty" aria-label="No artwork image" />;

  return (
    <div className="art-gallery">
      <button className="art-gallery-main" onClick={() => dialogRef.current?.showModal()} type="button" aria-label="Open artwork image full size">
        <img alt={selectedImage.alt || "Artwork"} src={selectedImage.src} />
        <span>View full size</span>
      </button>
      {images.length > 1 && (
        <div className="art-gallery-thumbnails" role="group" aria-label="Artwork images">
          {images.map((image, index) => (
            <button
              aria-label={`Show image ${index + 1}`}
              aria-pressed={index === selectedIndex}
              className={index === selectedIndex ? "is-selected" : ""}
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <img alt="" loading="lazy" src={image.src} />
            </button>
          ))}
        </div>
      )}
      <dialog className="art-image-dialog" ref={dialogRef}>
        <button className="art-image-dialog-close" onClick={() => dialogRef.current?.close()} type="button">Close</button>
        <img alt={selectedImage.alt || "Artwork"} src={selectedImage.src} />
      </dialog>
    </div>
  );
}
