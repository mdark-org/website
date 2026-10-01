# Section 同步写入

## 范围

源同步在写入 `pageRevision` 时生成 `page_sections`。本文不涉及 Cloudflare AI Search 索引、查询或 A/B 发布。现有同步完成后发布内容的流程保持不变，但发布前会检查每个页面的 Sections 是否完整。

## 解析约定

- 始终生成 `ordinal = 0` 的 root Section，包括空文档。root 正文为首个 heading 之前的内容。
- 每个 heading 的正文从该 heading 末尾开始，至下一个同级或更高级 heading 之前结束。父 Section 包含子段正文，子段变化会改变祖先 Section 的 hash。
- 正文不包含本 Section 的 heading syntax，保留原始空白和换行。数据库不重复保存正文。
- `startOffset`、`endOffset` 为 JavaScript 字符串索引，不是 UTF-8 byte offset；通过 `markdown.slice(startOffset, endOffset)` 取回正文。
- 解析器与页面渲染器共享 `remark-parse`、`remark-gfm`、Fumadocs `remarkHeading`。显式锚点使用 `[#id]`，自动锚点使用渲染器的重复标题编号规则。
- 重复显式锚点，以及显式锚点与自动锚点冲突，会使同步失败，避免生成有歧义的 Section identity。

## 身份与复用

SourceBuilder 保留源文件的 provider key，且页面 transformer 不能覆盖它。持久化的 `sourceKey` 由 datasource 的稳定 ID 与 provider key 组成，不依赖页面 URL。改写 URL 不改变 Section identity；移动源文件则视为新身份。

`sectionId` 由 `sourceKey` 和锚点生成，root 使用独立 locator。`bodyHash` 只包含原始正文，`sectionHash` 包含标题、heading path 和 body hash。

`SECTION_PARSER_VERSION` 参与新 Revision 的复用 key。改变 Section 边界或锚点规则时必须提升该版本。已有 Revision 与 Sections 保持原样，新同步生成新 Revision。

同步通过批量查询 root 行判断 Sections 是否完整，已完成的 Revision 不再解析或写入 Sections。新 Revision 和完整 Sections 放在单个 D1 `batch()` 中。这里依赖的是 D1 对单个 batch 的原子性，不使用交互式 `BEGIN/COMMIT`，也不假设多个 batch 或 Workflow steps 之间有事务保证。

正文写入、不同 Revision 批次和 datasource refs 的提交仍是独立操作。失败可能留下未被发布的内容行，重试通过不可变 key 和完整 Section 标记恢复，不做整个同步运行的全局回滚。

## 迁移与 Backfill

先对目标 D1 应用新增迁移，再部署同步 Worker：

```sh
cd fuma
pnpm exec cf d1 migrations apply "$D1_DATABASE_ID" --dir drizzle/d1
```

`0002_page_sections.sql` 只增加 Section 表、外键和索引，不重建旧表。旧迁移快照已有 ID 列类型与当前 schema 的差异，本次保持原定义，不顺带修复。

下一次源同步在发布前执行分批 backfill，每批最多处理 25 个缺少 root 行的 Revision。Workflow 保存每批的检查点，已提交的 Revision 不会重新解析。单页回填失败不会留下部分 root completion marker。

内部也可调用 `backfillPageSections(repo, { limit })` 处理一批，重复调用至返回 `revisions = 0`。已有 Revision 的旧 `sourceKey` 不会被改写；新的稳定身份由后续 SourceBuilder 同步引入。

## 验证

```sh
pnpm --filter @repo/source test
pnpm --filter @repo/source exec node --import ./test/register.mjs --test ../../fuma/test/markdown.test.ts ../../fuma/test/datasource.test.ts
```

D1 集成测试使用独立的临时 Miniflare 数据库，应用完整迁移链，不修改本地开发数据库或远端数据库。
