import changelogData from "@/content/changelog.json";

type ChangelogItem = {
  time: string;
  title?: string;
  content?: string;
};

const items: ChangelogItem[] = changelogData;
const gridColor = "color-mix(in oklab, var(--color-fd-primary) 10%, transparent)";

export default function ChangelogPage() {
  return (
    <>
      <div
        className="absolute inset-x-0 top-[360px] h-[250px] max-md:hidden"
        style={{
          background: `repeating-linear-gradient(to right, ${gridColor}, ${gridColor} 1px,transparent 1px,transparent 50px), repeating-linear-gradient(to bottom, ${gridColor}, ${gridColor} 1px,transparent 1px,transparent 50px)`,
        }}
      />
      <main className="container mx-auto relative z-[2] max-w-[1100px] px-2 py-4 lg:py-8">
        <div
          style={{
            background:
              "repeating-linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-fd-primary) 1%, transparent) 500px, transparent 1000px)",
          }}
        >
          <section
            className="relative overflow-hidden border-x border-t px-6 py-8 md:px-12 md:py-14"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, var(--color-fd-secondary), var(--color-fd-background) 40%)",
            }}
          >
            <div
              className="absolute inset-0 z-[-1] blur-2xl dark:hidden"
              style={{
                maskImage: "linear-gradient(to bottom, transparent, white, transparent)",
                background:
                  "repeating-linear-gradient(65deg, var(--color-purple-300), var(--color-purple-300) 12px, color-mix(in oklab, var(--color-blue-600) 30%, transparent) 20px, transparent 200px)",
              }}
            />
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">更新日志</h1>
            <p className="mt-4 max-w-[760px] text-fd-muted-foreground md:text-lg">
              记录 MDARK 功能更新、体验优化与问题修复。
            </p>
          </section>

          <section
            className="border-x border-y px-6 py-6 md:px-12 md:py-8"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, var(--color-fd-secondary), var(--color-fd-background) 40%)",
            }}
          >
            <div className="divide-y divide-fd-border/60  border-fd-border/60">
              {items.map((item) => (
                <article
                  key={`${item.time}-${item.title ?? item.content}`}
                  className="py-6 md:py-8"
                >
                  <span className="inline-flex rounded-full border border-fd-border px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-fd-muted-foreground">
                    {item.time}
                  </span>

                  {item.content ? (
                    <p className="mt-4 whitespace-pre-line leading-7 text-fd-muted-foreground">
                      {item.content}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
