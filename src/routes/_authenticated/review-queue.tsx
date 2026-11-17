import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/review-queue")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/catalogue" });
  },
  component: () => <Outlet />,
});
