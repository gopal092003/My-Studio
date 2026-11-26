"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContentMediaType, Database } from "@/types/database";
import { realms, type RealmSlug, type SupabaseProject } from "@/features/landing/data/realms";
import { deleteContentAction, saveContentAction } from "@/app/admin/actions";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ImagePreview = { id: string; src: string; alt: string };

const mediaTypes: { value: ContentMediaType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Images" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
  { value: "external", label: "External link" },
];

function localDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ContentItemEditor({
  id,
  item,
  databaseProject = "primary",
  defaultSectionSlug,
  imagePreviews = [],
  canUploadImages = true,
}: {
  id: string;
  item?: ContentItem;
  databaseProject?: SupabaseProject;
  defaultSectionSlug?: RealmSlug;
  imagePreviews?: ImagePreview[];
  canUploadImages?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scheduleValue, setScheduleValue] = useState("");

  useEffect(() => setScheduleValue(localDateTime(item?.scheduled_publish_at)), [item?.scheduled_publish_at]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsUploading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("image_files") as HTMLInputElement | null;
    const files = Array.from(fileInput?.files ?? []);
    const uploadedPaths: string[] = [];
    let client: ReturnType<typeof createSupabaseBrowserClient> | undefined;

    try {
      if (files.length > 20) throw new Error("Choose up to 20 images.");
      if (!canUploadImages && files.length > 0) throw new Error("Image uploads are available for the primary project. Use a public media URL for this project.");
      if (files.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error("Each image must be JPEG, PNG, WebP, or GIF and no larger than 10 MB.");
      }

      if (files.length > 0) {
        client = createSupabaseBrowserClient(databaseProject);
        const sectionSlug = String(formData.get("section_slug") ?? "");
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "content-image";
          const path = `${sectionSlug}/${id}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await client.storage.from("content-assets").upload(path, file, {
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
      const scheduleInput = form.elements.namedItem("scheduled_publish_at") as HTMLInputElement | null;
      if (scheduleInput?.value) formData.set("scheduled_publish_at", new Date(scheduleInput.value).toISOString());

      startTransition(async () => {
        try {
          await saveContentAction(formData);
          router.refresh();
        } catch (error) {
          if (client && uploadedPaths.length > 0) await client.storage.from("content-assets").remove(uploadedPaths);
          setErrorMessage(error instanceof Error ? error.message : "Could not save content.");
        } finally {
          setIsUploading(false);
        }
      });
    } catch (error) {
      if (client && uploadedPaths.length > 0) await client.storage.from("content-assets").remove(uploadedPaths);
      setErrorMessage(error instanceof Error ? error.message : "Could not upload images.");
      setIsUploading(false);
    }
  }

  return (
    <div className="content-item-editor">
      {imagePreviews.length > 0 && (
        <div className="artwork-editor-gallery" aria-label="Current content images">
          {imagePreviews.map((image) => <img key={image.id} src={image.src} alt={image.alt || item?.title || "Page content"} />)}
        </div>
      )}
      <form action={saveContentAction} className="content-form" onSubmit={handleSubmit}>
        <input name="id" type="hidden" value={id} />
        {databaseProject && <input name="database_project" type="hidden" value={databaseProject} />}
        <label>
          Page
        <select defaultValue={item?.section_slug ?? defaultSectionSlug ?? "craft"} name="section_slug" required>
          {realms.filter((realm) => realm.slug !== "art" && realm.supabaseProject === databaseProject && (!item || realm.slug === item.section_slug))
            .map((realm) => <option key={realm.slug} value={realm.slug}>{realm.title}</option>)}
          </select>
        </label>
        <label>
          Title
          <input defaultValue={item?.title ?? ""} maxLength={180} name="title" required />
        </label>
        <label>
          Medium / format
          <input defaultValue={item?.medium ?? ""} maxLength={100} name="medium" placeholder="Watercolor, chapter, sonnet, OST…" />
        </label>
        <label>
          Dimensions (optional)
          <input defaultValue={item?.dimensions ?? ""} maxLength={100} name="dimensions" placeholder="30 × 40 cm" />
        </label>
        <label>
          Tags
          <input defaultValue={item?.tags.join(", ") ?? ""} name="tags" placeholder="fantasy, episode 1, piano" />
        </label>
        <label>
          Content format
          <select defaultValue={item?.media_type ?? "text"} name="media_type">
            {mediaTypes.map((mediaType) => <option key={mediaType.value} value={mediaType.value}>{mediaType.label}</option>)}
          </select>
        </label>
        <label className="field-wide">
          Description
          <textarea defaultValue={item?.summary ?? ""} maxLength={5000} name="summary" placeholder="A short introduction…" />
        </label>
        <label className="field-wide">
          Text / chapter / poem
          <textarea defaultValue={item?.body ?? ""} maxLength={50000} name="body" placeholder="Write the content here, or add an external audio/video link below." />
        </label>
        <label className="field-wide">
          Audio, video, document, or external media URL
          <input defaultValue={item?.asset_url ?? ""} name="asset_url" type="url" />
        </label>
        <label className="field-wide">
          Images {item ? "(choose images to replace the current set)" : "(optional)"}
          <input accept="image/jpeg,image/png,image/webp,image/gif" disabled={!canUploadImages} multiple name="image_files" type="file" />
        </label>
        {!canUploadImages && <p className="field-help field-wide">Image uploads need a primary-project admin session. Add a public media URL for this secondary-project item.</p>}
        <label className="published-field">
          <input defaultChecked={item?.is_published ?? false} name="is_published" type="checkbox" />
          Publish this item
        </label>
        <label>
          Schedule publishing
          <input onChange={(event) => setScheduleValue(event.target.value)} name="scheduled_publish_at" type="datetime-local" value={scheduleValue} />
        </label>
        <p className="field-help field-wide">A scheduled item remains hidden until its publish time. Uncheck publish to keep it hidden.</p>
        <div className="content-form-actions">
          <button className="button-primary" disabled={isPending || isUploading} type="submit">
            {isUploading ? "Uploading…" : isPending ? "Saving…" : item ? "Save changes" : "Add content"}
          </button>
        </div>
      </form>
      {item && (
        <form action={deleteContentAction} className="delete-artwork-form">
          <input name="id" type="hidden" value={id} />
          <input name="section_slug" type="hidden" value={item.section_slug} />
          <input name="database_project" type="hidden" value={databaseProject} />
          <button className="button-danger" type="submit">Delete content</button>
        </form>
      )}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
    </div>
  );
}
