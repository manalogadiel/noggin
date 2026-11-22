import { redirect } from "next/navigation";
import { LearningProgressView } from "@/components/student/learning-progress-view";
import { createContainer } from "@/composition/container";

export default async function ProfileProgressPage() {
  const container = await createContainer();
  const result = await container.getLearningProgress();

  if (result.status === "unauthenticated") {
    redirect("/login?next=%2Fprofile%2Fprogress");
  }

  return (
    <LearningProgressView summary={result.summary} nogs={result.nogs} />
  );
}
