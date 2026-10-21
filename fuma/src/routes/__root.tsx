import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";
import { Provider } from "@/components/provider";
import { GoogleAnalytics } from "@/components/google-analytics";
import globalCss from "@/styles/global.css?url";
import interCss from "@fontsource/inter/latin.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MDARK" },
      { name: "description", content: "MDARK" },
      { name: "keywords", content: "MDARK,mdark,markdown-archive" },
    ],
    links: [
      { rel: "stylesheet", href: globalCss },
      { rel: "stylesheet", href: interCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: DefaultNotFound,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
        <Provider>
          <Outlet />
        </Provider>
        <GoogleAnalytics gaId={import.meta.env.VITE_GAID} />
        <Scripts />
      </body>
    </html>
  );
}
