"use server";

import { revalidatePath } from "next/cache";
import { createContainer } from "@/composition/container";
import type {
  CustomizeNogInput,
  CustomizeNogResult,
} from "@/core/application/use-cases/customize-nog";

export async function customizeNogAction(
  input: CustomizeNogInput,
): Promise<CustomizeNogResult> {
  const container = await createContainer();
  const result = await container.customizeNog(input);

  if (result.status === "ok") {
    revalidatePath(`/nogs/${input.nogId}`);
  }

  return result;
}
