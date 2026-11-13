import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NMK Pricelist to ERP" },
      { name: "description", content: "Internal tool that turns vendor pricelists into ERP upload files." },
      { property: "og:title", content: "NMK Pricelist to ERP" },
      { property: "og:description", content: "Internal tool that turns vendor pricelists into ERP upload files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/convert" });
  },
});
