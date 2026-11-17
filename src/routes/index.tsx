import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace · NMK Unite" },
      { name: "description", content: "Internal tool that turns vendor pricelists into ERP upload files." },
      { property: "og:title", content: "Workspace · NMK Unite" },
      { property: "og:description", content: "Internal tool that turns vendor pricelists into ERP upload files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/convert" });
  },
});
