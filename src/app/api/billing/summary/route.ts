import { NextResponse } from "next/server";
import { createContainer } from "@/composition/container";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let container;
  try {
    container = await createContainer();
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }

  const result = await container.getBillingSummary();
  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  return NextResponse.json(result.summary);
}
