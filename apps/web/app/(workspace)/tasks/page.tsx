import { TasksView } from "@/features/tasks/tasks-view";
import { getTasksData } from "@/lib/queries/tasks";

export default async function TasksPage() {
  const data = await getTasksData();
  return <TasksView data={data} />;
}
