import { redirect } from "next/navigation";
import { saveAccountAction } from "@/app/(app)/actions/profile-actions";
import { signOutAction } from "@/app/(auth)/actions";
import { AccountForm } from "@/components/student/account-form";
import { createContainer } from "@/composition/container";
import { DEFAULT_PROFILE_SETTINGS } from "@/core/application/ports";

export default async function ProfileAccountPage() {
  const container = await createContainer();
  const [displayName, emailFromContainer, user, settingsResult] =
    await Promise.all([
      container.getDisplayName(),
      typeof container.getEmail === "function"
        ? container.getEmail()
        : Promise.resolve(null),
      container.currentUser.get(),
      container.getProfileSettings(),
    ]);

  if (settingsResult.status === "unauthenticated") {
    redirect("/login?next=%2Fprofile%2Faccount");
  }

  const email = emailFromContainer ?? user?.email ?? "";
  const initialSettings =
    settingsResult.status === "ok"
      ? settingsResult.settings
      : DEFAULT_PROFILE_SETTINGS;

  return (
    <AccountForm
      initialDisplayName={displayName ?? ""}
      email={email}
      initialSettings={initialSettings}
      onSave={saveAccountAction}
      onSignOut={signOutAction}
    />
  );
}
