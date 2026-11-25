import { NextResponse } from "next/server";
import { createContainer } from "@/composition/container";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  let container;
  try {
    container = await createContainer();
  } catch {
    return NextResponse.json({ state: "unavailable" }, { status: 503 });
  }

  const result = await container.cancelNogginPlus();
  if (result.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (result.status === "not_found") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ subscription: result.subscription });
}
