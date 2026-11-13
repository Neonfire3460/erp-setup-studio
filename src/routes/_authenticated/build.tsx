import { createFileRoute } from "@tanstack/react-router";
import { BuildTool } from "@/components/BuildTool";
import { buildOptions } from "@/lib/buildQueries";

export const Route = createFileRoute("/_authenticated/build")({
  loader: ({ context }) => context.queryClient.ensureQueryData(buildOptions),
  head: () => ({
    meta: [
      { title: "Build · NMK Pricelist to ERP" },
      { name: "description", content: "Build page of the NMK pricelist to ERP tool." },
      { property: "og:title", content: "Build · NMK Pricelist to ERP" },
      { property: "og:description", content: "Build page of the NMK pricelist to ERP tool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildTool,
});
