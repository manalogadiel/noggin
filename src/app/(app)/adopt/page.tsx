import type { Metadata } from "next";
import { AdoptFlow } from "@/components/nog/adopt-flow";

export const metadata: Metadata = {
  title: "Adopt a Nog",
};

export default function AdoptPage() {
  return <AdoptFlow />;
}
