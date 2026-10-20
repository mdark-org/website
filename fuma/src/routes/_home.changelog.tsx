import { createFileRoute } from "@tanstack/react-router";
import ChangelogPage from "@/components/changelog-page";

export const Route = createFileRoute("/_home/changelog")({
  head: () => ({
    meta: [{ title: "更新日志" }, { name: "description", content: "MDARK 更新日志" }],
  }),
  component: ChangelogPage,
});
