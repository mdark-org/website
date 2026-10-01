import { cp, mkdir, readdir, rm } from "node:fs/promises";

const src = "drizzle/migrations";
const dest = "drizzle/d1";

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

const dirs = (await readdir(src, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

await Promise.all(
  dirs.map((dir, i) => {
    const name = dir.split("_").slice(1).join("_") || dir;
    return cp(`${src}/${dir}/migration.sql`, `${dest}/${String(i).padStart(4, "0")}_${name}.sql`);
  }),
);
console.log(`Synced ${dirs.length} migration${dirs.length === 1 ? "" : "s"} to ${dest}`);
