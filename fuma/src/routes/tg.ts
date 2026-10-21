import { createFileRoute } from "@tanstack/react-router";
import { tgLink } from "@/config";

export const Route = createFileRoute("/tg")({
  server: { handlers: { GET: () => Response.redirect(tgLink, 301) } },
});
