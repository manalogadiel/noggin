"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { customizeNogAction } from "@/app/(app)/actions/customize-actions";
import {
  NogCustomizeStage,
  type NogCustomizeSubmitPayload,
} from "@/components/customize/nog-customize-stage";
import type { NogRecord } from "@/core/application/ports";

export interface CustomizeViewProps {
  nog: NogRecord;
}

export function CustomizeView({ nog }: CustomizeViewProps) {
  const router = useRouter();
  const initialColor = nog.colors?.body ?? null;
  const initialName = nog.name.trim();
  const roomHref = `/nogs/${nog.id}`;

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDone({ name, bodyColor }: NogCustomizeSubmitPayload) {
    if (isSaving) return;

    const colorChanged = bodyColor !== initialColor;
    const nameChanged = name !== initialName;

    if (!colorChanged && !nameChanged) {
      router.push(roomHref);
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await customizeNogAction({
        nogId: nog.id,
        body: bodyColor,
        ...(nameChanged ? { name } : {}),
      });

      if (result.status === "ok") {
        router.push(roomHref);
        return;
      }

      if (result.status === "invalid") {
        setErrorMessage("That color didn’t stick — pick another");
      } else if (result.status === "invalid_name") {
        setErrorMessage("Give your Nog a name between 1 and 24 characters.");
      } else {
        setErrorMessage("Couldn’t save — try again");
      }
    } catch {
      setErrorMessage("Couldn’t save — try again");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <NogCustomizeStage
      mode="edit"
      nogId={nog.id}
      stage={nog.stage}
      initialName={nog.name}
      initialBodyColor={initialColor}
      submitLabel="Done"
      savingLabel="Saving…"
      isSaving={isSaving}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(null)}
      onSubmit={handleDone}
    />
  );
}
