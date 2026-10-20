import { createFileRoute, Outlet } from "@tanstack/react-router";
import HomeLayout from "@/components/home-layout";

export const Route = createFileRoute("/_home")({
  component: () => (
    <HomeLayout>
      <Outlet />
    </HomeLayout>
  ),
});
