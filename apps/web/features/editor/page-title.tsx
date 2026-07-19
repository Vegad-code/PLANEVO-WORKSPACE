"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  updatePageCover,
  updatePageIcon,
  updatePageTitle,
} from "@/app/(workspace)/pages/[pageId]/actions";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { uploadPageAsset } from "@/features/editor/upload-file";

type PageTitleContextValue = {
  pageId: string;
  title: string;
  icon: string | null;
  coverImage: string | null;
  setTitle: (title: string) => void;
  commitTitle: () => Promise<void>;
  commitIcon: (next: string | null) => Promise<void>;
  pickCover: () => void;
  removeCover: () => Promise<void>;
  isUploadingCover: boolean;
  coverError: string | null;
  coverInputRef: RefObject<HTMLInputElement | null>;
  onCoverSelected: (event: ChangeEvent<HTMLInputElement>) => void;
};

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function usePageTitleContext(): PageTitleContextValue {
  const value = useContext(PageTitleContext);
  if (!value) {
    throw new Error("usePageTitleContext must be used within PageTitleRoot.");
  }
  return value;
}

function usePageTitleState({
  pageId,
  initialTitle,
  initialIcon,
  initialCoverImage,
}: {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialCoverImage: string | null;
}): PageTitleContextValue {
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

  return {
    pageId,
    title,
    icon,
    coverImage,
    setTitle,
    commitTitle,
    commitIcon,
    pickCover,
    removeCover,
    isUploadingCover,
    coverError,
    coverInputRef,
    onCoverSelected,
  };
}

type PageTitleRootProps = {
  pageId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialCoverImage: string | null;
  children: ReactNode;
};

export function PageTitleRoot({
  pageId,
  initialTitle,
  initialIcon,
  initialCoverImage,
  children,
}: PageTitleRootProps) {
  const state = usePageTitleState({
    pageId,
    initialTitle,
    initialIcon,
    initialCoverImage,
  });

  return (
    <PageTitleContext.Provider value={state}>
      <input
        ref={state.coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={state.onCoverSelected}
      />
      {children}
    </PageTitleContext.Provider>
  );
}

export function PageTitleCover() {
  const {
    coverImage,
    coverError,
    isUploadingCover,
    pickCover,
    removeCover,
  } = usePageTitleContext();

  return (
    <div className="w-full">
      {coverImage ? (
        <div className="group relative w-full overflow-hidden rounded-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img
            src={coverImage}
            alt=""
            className="h-40 w-full object-cover sm:h-48"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-paper/80 p-3 opacity-0 transition-opacity group-hover:opacity-100">
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
        <div className="px-5 sm:px-8">
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

      {coverError && (
        <p role="status" className="px-5 text-small text-brick sm:px-8">
          {coverError}
        </p>
      )}
    </div>
  );
}

export function PageTitleHeading() {
  const { title, icon, setTitle, commitTitle, commitIcon } = usePageTitleContext();

  return (
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
  );
}

/** Default stacked layout for simpler page shells. */
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
  return (
    <PageTitleRoot
      pageId={pageId}
      initialTitle={initialTitle}
      initialIcon={initialIcon}
      initialCoverImage={initialCoverImage}
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <PageTitleCover />
        <PageTitleHeading />
      </div>
    </PageTitleRoot>
  );
}
