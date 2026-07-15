import { FileEntry } from "@/app/components/file-entry";
import { getFilesData } from "@/lib/queries/files";

export default async function NewFilePage() {
  const data = await getFilesData();
  return <FileEntry workspaceId={data.workspaceId} />;
}
