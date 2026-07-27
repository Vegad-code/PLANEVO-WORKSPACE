import { cookies } from "next/headers";
import { FilesProductSkeleton } from "@/features/files-product/files-product-skeleton";
import {
  DEFAULT_LIBRARY_WIDTH,
  FILES_LIBRARY_COLLAPSED_COOKIE,
} from "@/lib/files/library-prefs";

export default async function FilesLoading() {
  const jar = await cookies();
  const collapsed =
    jar.get(FILES_LIBRARY_COLLAPSED_COOKIE)?.value === "true";

  return (
    <FilesProductSkeleton
      initialCollapsed={collapsed}
      initialWidth={DEFAULT_LIBRARY_WIDTH}
    />
  );
}
