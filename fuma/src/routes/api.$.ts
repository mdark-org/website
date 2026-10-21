import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { default: app } = await import("@/api/server");
  return app.fetch(request);
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      DELETE: handle,
      PUT: handle,
      OPTIONS: handle,
      HEAD: handle,
    },
  },
});
