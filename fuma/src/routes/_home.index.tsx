import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/components/home-page";
import { getRecentPages } from "@/lib/content.functions";

export const Route = createFileRoute("/_home/")({
  loader: () => getRecentPages(),
  component: () => <HomePage pages={Route.useLoaderData()} />,
});
