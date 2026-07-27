import { NuqsAdapter } from "nuqs/adapters/next/app";
import { CalendarQueryProvider } from "@/features/calendar-product/calendar-query-provider";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NuqsAdapter>
      <CalendarQueryProvider>{children}</CalendarQueryProvider>
    </NuqsAdapter>
  );
}
