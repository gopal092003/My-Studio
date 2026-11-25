"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import { deleteArtworkAction, saveArtworkAction } from "@/app/admin/art/actions";

type Artwork = Database["public"]["Tables"]["artworks"]["Row"];
type ImagePreview = { id: string; src: string; alt: string };

type ArtworkEditorProps = {
  id: string;
  artwork?: Artwork;
  imagePreviews?: ImagePreview[];
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImages = 20;

function localDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ArtworkEditor({ id, artwork, imagePreviews = [] }: ArtworkEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scheduleValue, setScheduleValue] = useState("");

  useEffect(() => {
    setScheduleValue(localDateTime(artwork?.scheduled_publish_at));
  }, [artwork?.scheduled_publish_at]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsUploading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("image_files") as HTMLInputElement | null;
    const files = Array.from(fileInput?.files ?? []);
    const uploadedPaths: string[] = [];
    let supabase: ReturnType<typeof createSupabaseBrowserClient> | undefined;

    try {
      if (files.length > maxImages) throw new Error(`Choose up to ${maxImages} images.`);
      if (!artwork && files.length === 0) throw new Error("Choose at least one artwork image.");
      if (files.some((file) => !imageTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error("Each image must be JPEG, PNG, WebP, or GIF and no larger than 10 MB.");
      }

      if (files.length > 0) {
        supabase = createSupabaseBrowserClient("primary");
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "artwork-image";
          const path = `${id}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage.from("artworks").upload(path, file, {
            cacheControl: "31536000",
            contentType: file.type,
            upsert: false,
          });
          if (error) throw new Error(`Image upload failed: ${error.message}`);
          uploadedPaths.push(path);
        }
      }

      formData.set("image_paths", JSON.stringify(uploadedPaths));
      formData.delete("image_files");
      const scheduledInput = form.elements.namedItem("scheduled_publish_at") as HTMLInputElement | null;
      if (scheduledInput?.value) formData.set("scheduled_publish_at", new Date(scheduledInput.value).toISOString());

      startTransition(async () => {
        try {
          await saveArtworkAction(formData);
          router.refresh();
        } catch (error) {
          if (uploadedPaths.length > 0 && supabase) {
            await supabase.storage.from("artworks").remove(uploadedPaths);
          }
          setErrorMessage(error instanceof Error ? error.message : "Could not save artwork.");
        } finally {
          setIsUploading(false);
        }
      });
    } catch (error) {
      if (uploadedPaths.length > 0 && supabase) {
        await supabase.storage.from("artworks").remove(uploadedPaths);
      }
      setErrorMessage(error instanceof Error ? error.message : "Could not upload artwork.");
      setIsUploading(false);
    }
  }

  return (
    <div className="artwork-editor">
      {imagePreviews.length > 0 && (
        <div className="artwork-editor-gallery" aria-label="Current artwork images">
          {imagePreviews.map((image) => <img key={image.id} src={image.src} alt={image.alt || artwork?.name || "Artwork"} />)}
        </div>
      )}
      <form className="content-form" onSubmit={handleSubmit}>
        <input name="id" type="hidden" value={id} />
        <input name="image_path" type="hidden" value={artwork?.image_path ?? ""} />
        <label>
          Artwork name
          <input defaultValue={artwork?.name ?? ""} maxLength={180} name="name" required />
        </label>
        <label>
          Medium
          <input defaultValue={artwork?.medium ?? ""} maxLength={100} name="medium" placeholder="Watercolor, pencil, digital…" />
        </label>
        <label>
          Dimensions
          <input defaultValue={artwork?.dimensions ?? ""} maxLength={100} name="dimensions" placeholder="30 × 40 cm" />
        </label>
        <label>
          Tags
          <input defaultValue={artwork?.tags.join(", ") ?? ""} name="tags" placeholder="watercolor, landscape, study" />
        </label>
        <label className="field-wide">
          Description
          <textarea defaultValue={artwork?.description ?? ""} maxLength={5000} name="description" placeholder="Tell visitors about this artwork…" />
        </label>
        <label className="field-wide">
          Artwork images {artwork ? "(choose images to replace the current set)" : "(choose at least one)"}
          <input accept="image/jpeg,image/png,image/webp,image/gif" multiple name="image_files" required={!artwork} type="file" />
        </label>
        <label className="published-field">
          <input defaultChecked={artwork?.is_visible ?? true} name="is_visible" type="checkbox" />
          Publish this artwork
        </label>
        <label>
          Schedule publishing
          <input
            onChange={(event) => setScheduleValue(event.target.value)}
            name="scheduled_publish_at"
            type="datetime-local"
            value={scheduleValue}
          />
        </label>
        <p className="field-help field-wide">A scheduled artwork stays hidden until the selected time. Uncheck publishing to keep it hidden.</p>
        <div className="content-form-actions">
          <button className="button-primary" disabled={isPending || isUploading} type="submit">
            {isUploading ? "Uploading…" : isPending ? "Saving…" : artwork ? "Save artwork" : "Add artwork"}
          </button>
        </div>
      </form>
      {artwork && (
        <form action={deleteArtworkAction} className="delete-artwork-form">
          <input name="id" type="hidden" value={id} />
          <button className="button-danger" type="submit">Delete artwork</button>
        </form>
      )}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </div>
  );
}
