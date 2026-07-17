"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  updatePageCover,
  updatePageIcon,
  updatePageTitle,
} from "@/app/(workspace)/pages/[pageId]/actions";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { uploadPageAsset } from "@/features/editor/upload-file";

export function PageTitle({
  pageId,
  initialTitle,
  initialIcon,
  initialCoverImage,
}: {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialCoverImage: string | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [coverImage, setCoverImage] = useState<string | null>(initialCoverImage);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isUploadingCover, startCoverUpload] = useTransition();
  const lastSaved = useRef(initialTitle);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function commitTitle() {
    const next = title.trim() || "Untitled";
    setTitle(next);
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    await updatePageTitle(pageId, next);
  }

  async function commitIcon(next: string | null) {
    const previous = icon;
    setIcon(next);
    const result = await updatePageIcon(pageId, next);
    if (!result.ok) setIcon(previous);
  }

  function pickCover() {
    coverInputRef.current?.click();
  }

  function onCoverSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    startCoverUpload(async () => {
      setCoverError(null);
      try {
        const url = await uploadPageAsset(file);
        const previous = coverImage;
        setCoverImage(url);
        const result = await updatePageCover(pageId, url);
        if (!result.ok) {
          setCoverImage(previous);
          setCoverError(result.error ?? "Failed to save cover.");
        }
      } catch (cause) {
        setCoverError(cause instanceof Error ? cause.message : "Failed to upload cover.");
      }
    });
  }

  async function removeCover() {
    const previous = coverImage;
    setCoverImage(null);
    const result = await updatePageCover(pageId, null);
    if (!result.ok) {
      setCoverImage(previous);
      setCoverError(result.error ?? "Failed to remove cover.");
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {coverImage ? (
        <div className="group relative -mx-1 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img
            src={coverImage}
            alt=""
            className="h-40 w-full object-cover sm:h-48"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-paper/80 p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={pickCover}
              disabled={isUploadingCover}
              className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              {isUploadingCover ? "Uploading…" : "Change cover"}
            </button>
            <button
              type="button"
              onClick={() => void removeCover()}
              disabled={isUploadingCover}
              className="h-8 rounded-lg px-3 text-small text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={pickCover}
            disabled={isUploadingCover}
            className="h-8 rounded-lg px-2 text-small text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {isUploadingCover ? "Uploading…" : "Add cover"}
          </button>
        </div>
      )}

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCoverSelected}
      />

      {coverError && (
        <p role="status" className="text-small text-brick">
          {coverError}
        </p>
      )}

      <div className="flex min-w-0 items-start gap-3">
        <EmojiPicker value={icon} onChange={(next) => void commitIcon(next)} />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          aria-label="Page title"
          placeholder="Untitled"
          className="min-w-0 flex-1 bg-transparent text-h1 outline-none placeholder:text-text-muted"
        />
      </div>
    </div>
  );
}
