import { FilesView } from "@/app/components/files-view";
import { getFilesData } from "@/lib/queries/files";

export default async function FilesPage() {
  const data = await getFilesData();
  return <FilesView data={data} />;
}
