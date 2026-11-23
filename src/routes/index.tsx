import { createFileRoute, redirect } from "@tanstack/react-router";
import { headFor } from "@/lib/v3/page";

export const Route = createFileRoute("/")({
  head: () => headFor("Home", "NMK Unite: item registration, PDF pricelists and ERP uploads."),
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
