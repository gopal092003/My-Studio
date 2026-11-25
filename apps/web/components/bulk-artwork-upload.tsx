"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateArtworksAction } from "@/app/admin/art/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxFiles = 25;

export function BulkArtworkUpload() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsUploading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("bulk_image_files") as HTMLInputElement | null;
    const files = Array.from(fileInput?.files ?? []);
    const uploadedPaths: string[] = [];
    let supabase: ReturnType<typeof createSupabaseBrowserClient> | undefined;

    try {
      if (files.length < 1 || files.length > maxFiles) throw new Error(`Choose between 1 and ${maxFiles} images.`);
      if (files.some((file) => !imageTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error("Each image must be JPEG, PNG, WebP, or GIF and no larger than 10 MB.");
      }

      supabase = createSupabaseBrowserClient("primary");
      const items = [];
      for (const file of files) {
        const id = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "artwork-image";
        const path = `${id}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("artworks").upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error(`Image upload failed: ${error.message}`);
        uploadedPaths.push(path);
        const artworkName = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 180) || "Untitled artwork";
        items.push({ id, name: artworkName, image_path: path });
      }

      formData.set("items", JSON.stringify(items));
      formData.delete("bulk_image_files");
      startTransition(async () => {
        try {
          await bulkCreateArtworksAction(formData);
          setSuccessMessage(`${items.length} artwork${items.length === 1 ? "" : "s"} added.`);
          formRef.current?.reset();
          router.refresh();
        } catch (error) {
          if (supabase) await supabase.storage.from("artworks").remove(uploadedPaths);
          setErrorMessage(error instanceof Error ? error.message : "Could not finish bulk upload.");
        } finally {
          setIsUploading(false);
        }
      });
    } catch (error) {
      if (uploadedPaths.length > 0 && supabase) await supabase.storage.from("artworks").remove(uploadedPaths);
      setErrorMessage(error instanceof Error ? error.message : "Could not upload artwork images.");
      setIsUploading(false);
    }
  }

  return (
    <section className="bulk-upload-panel">
      <p>Each filename becomes an artwork name. Shared medium and tags are applied to every image.</p>
      <form className="content-form" onSubmit={handleSubmit} ref={formRef}>
        <label className="field-wide">
          Images (up to {maxFiles})
          <input accept="image/jpeg,image/png,image/webp,image/gif" multiple name="bulk_image_files" required type="file" />
        </label>
        <label>
          Shared medium
          <input maxLength={100} name="medium" placeholder="Digital, watercolor…" />
        </label>
        <label>
          Shared tags
          <input name="tags" placeholder="study, landscape, 2026" />
        </label>
        <div className="content-form-actions">
          <button className="button-secondary" disabled={isPending || isUploading} type="submit">
            {isUploading ? "Uploading…" : isPending ? "Saving…" : "Bulk upload artwork"}
          </button>
        </div>
      </form>
      {successMessage && <p className="form-message" role="status">{successMessage}</p>}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </section>
  );
}
