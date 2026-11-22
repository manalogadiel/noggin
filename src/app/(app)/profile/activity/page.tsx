import { redirect } from "next/navigation";
import { RecentActivityView } from "@/components/student/recent-activity-view";
import { createContainer } from "@/composition/container";

export default async function ProfileActivityPage() {
  const container = await createContainer();
  const now = container.clock ? container.clock.now() : new Date();
  const result = await container.getRecentActivity();

  if (result.status === "unauthenticated") {
    redirect("/login?next=%2Fprofile%2Factivity");
  }

  return <RecentActivityView events={result.events} now={now} />;
}
