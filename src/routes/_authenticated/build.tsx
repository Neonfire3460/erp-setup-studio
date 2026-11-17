import { createFileRoute } from "@tanstack/react-router";
import { BuildTool } from "@/components/BuildTool";
import { buildOptions } from "@/lib/buildQueries";

export const Route = createFileRoute("/_authenticated/build")({
  loader: ({ context }) => context.queryClient.ensureQueryData(buildOptions),
  head: () => ({
    meta: [
      { title: "NMK Unite" },
      { name: "description", content: "Build page of the NMK Unite workspace." },
      { property: "og:title", content: "NMK Unite" },
      { property: "og:description", content: "Build page of the NMK Unite workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildTool,
});
