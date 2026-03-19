# PaperAgent — AI 学术论文生成平台

> 用户输入题目、要求和字数，自动生成结构化学术论文，支持分段编辑、AI 润色和 PDF 导出。

---

## 一、技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite | 你熟悉 React hooks，Vite 比 webpack 快很多 |
| UI 组件库 | Ant Design 5 | 你已熟悉，开箱即用，表单/布局/弹窗组件丰富 |
| 状态管理 | Zustand | 比 Redux 轻量很多，API 简洁，适合中型项目 |
| Markdown 编辑器 | @uiw/react-md-editor | 基于 CodeMirror，自带预览，支持数学公式，比 Tiptap 简单 10 倍 |
| 后端 | Python 3.12 + FastAPI | 异步支持好，调 LLM 和 Pandoc 方便 |
| LLM 接入 | LiteLLM | 统一接口，用户 BYOK（自带 API Key），支持 GPT/Claude/DeepSeek 等 |
| PDF 引擎 | Pandoc + Typst | LLM 只生成 Markdown，Pandoc 转 Typst 渲染 PDF，排版质量极高 |
| 数据库 | SQLite（通过 SQLAlchemy） | 本地项目，零配置，单文件数据库，够用 |
| 容器化 | Docker Compose | 前端 Nginx + 后端 FastAPI + Pandoc/Typst 全部打包 |
| 代码规范 | ESLint + Prettier + TypeScript strict | 你已熟悉这套工具链 |

### 为什么选 Markdown 编辑器而不是 Tiptap？

| 对比 | Tiptap (WYSIWYG) | Markdown 编辑器 |
|------|:---:|:---:|
| 开发复杂度 | 高（自定义 Schema、插件） | 低（开箱即用） |
| 与 Pandoc 配合 | 需要额外转 Markdown | 天然 Markdown，直接喂给 Pandoc |
| LLM 输出对接 | 需要将 Markdown 转为 ProseMirror JSON | 直接显示 |
| 学习曲线 | 陡峭 | 平缓 |
| 稳定性 | 中（自定义越多 bug 越多） | 高 |

结论：Markdown 编辑器是本项目最稳的选择。内容格式统一为 Markdown，全链路无需格式转换。

---

## 二、系统架构

```
┌──────────────────────────────────────────────────────────┐
│                   前端 React + TypeScript                  │
│                                                           │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ 论文大纲  │  │ 分段 Markdown │  │  PDF 预览 (iframe)   │ │
│  │ 侧边栏   │  │  编辑器       │  │  + AI 对话面板       │ │
│  └─────────┘  └──────────────┘  └──────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │  REST API + SSE (流式)
┌──────────────────────▼───────────────────────────────────┐
│                  后端 Python FastAPI                       │
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐ │
│  │ LLM Service│  │Paper Service│  │  Export Service      │ │
│  │ (LiteLLM)  │  │ (分段 CRUD) │  │  (Pandoc + Typst)   │ │
│  └────────────┘  └────────────┘  └─────────────────────┘ │
│                                                           │
│  SQLite 数据库    预设 Typst 模板    用户上传图片 (work_dir) │
└──────────────────────────────────────────────────────────┘
```

### 为什么用 SSE 而不是 WebSocket？

- SSE 是单向的（服务端→客户端），正好符合"LLM 流式输出"的场景
- 实现比 WebSocket 简单得多，FastAPI 原生支持 `StreamingResponse`
- 不需要心跳、重连等复杂逻辑
- 浏览器原生 `EventSource` API 自动重连

---

## 三、核心功能规格

### 3.1 论文创建流程

```
用户操作流程：

1. 点击「新建论文」
2. 选择模板（数模竞赛 / 通用学术 / ...）
3. 填写基本信息：
   - 论文标题
   - 目标字数（如 8000 字）
   - 封面信息（队号/学号/姓名等，根据模板不同字段不同）
   - 题目要求 / 附加说明（用户贴入题目原文或描述）
4. 系统根据模板自动生成章节大纲（用户可微调）
5. 点击「开始生成」→ AI 逐章节生成内容
6. 用户审查、编辑、润色各章节
7. 填写参考文献
8. 点击「导出 PDF」
```

### 3.2 模板系统

每个模板定义两件事：**预设章节结构** + **Typst 排版样式**。

#### 模板列表（MVP 先做前两个）

| 模板 | 预设章节 | 封面字段 | 排版特点 |
|------|---------|---------|---------|
| **数模竞赛（国赛）** | 摘要、问题重述、问题分析、模型假设、符号说明、模型建立与求解、模型检验、模型评价与推广、参考文献、附录 | 题目、队号 | A4，宋体/Times New Roman，页眉带题目，公式自动编号 |
| **通用学术论文** | 摘要、引言、相关工作、方法/正文、实验/分析、结论、参考文献 | 题目、作者、学校、日期 | A4，宋体+黑体标题，1.5 倍行距 |
| **美赛 (MCM/ICM)** | Summary Sheet、Introduction、Assumptions、Model、Solution、Sensitivity Analysis、Conclusion、References | Title, Team #, Summary | Letter size, English, Times New Roman |
| **课程论文** | 摘要、引言、正文（自定义子章节）、结论、参考文献 | 课程名、题目、学生信息 | 简洁学术风格 |

#### 模板数据结构

```typescript
interface Template {
  id: string;
  name: string;              // "数模竞赛（国赛）"
  description: string;
  language: "zh" | "en";
  coverFields: CoverField[]; // 封面需要填写的字段
  defaultSections: DefaultSection[];
  typstTemplate: string;     // Typst 模板文件路径
}

interface CoverField {
  key: string;       // "team_id"
  label: string;     // "参赛队号"
  required: boolean;
  placeholder?: string;
}

interface DefaultSection {
  title: string;           // "摘要"
  order: number;
  description: string;     // 给 AI 的指令："写 200-300 字的摘要，概括全文"
  estimatedWordRatio: number; // 占总字数比例，如 0.05 表示 5%
  isRequired: boolean;     // 必需章节不可删除
}
```

#### 封面处理

封面作为 Typst 模板的一部分，内置在每个模板中。用户填写封面字段（如队号、姓名），编译时作为变量传入 Typst 模板。不做独立封面系统，保持简单。

#### 用户不可自定义模板

用户只能从预设模板中选择，不能上传或修改 Typst 模板文件。这保证了输出稳定性。用户能做的自定义限于：
- 增删章节（在预设结构基础上）
- 调整章节顺序
- 修改目标字数

### 3.3 章节（Section）编辑

每篇论文由多个 Section 组成，每个 Section 对应一个大章节（一级标题）。

#### Section 状态流转

```
                ┌──────────┐
     AI 生成    │          │  用户手动编辑
   ──────────► │   草稿    │ ◄──────────
                │  (draft)  │
                └─────┬────┘
                      │ 用户点击「确认」
                      ▼
                ┌──────────┐
                │  已确认    │
                │(confirmed)│
                └─────┬────┘
                      │ 用户点击「解锁重新编辑」
                      ▼
                ┌──────────┐
                │   草稿    │  （回到草稿状态）
                └──────────┘
```

#### 用户对每个 Section 的操作

| 操作 | 说明 |
|------|------|
| **AI 生成** | 首次生成或重新生成整段内容 |
| **AI 润色** | 润色/扩写/缩写/重写，弹出选项面板 |
| **手动编辑** | 直接在 Markdown 编辑器中修改 |
| **确认锁定** | 标记该章节已满意 |
| **解锁** | 重新打开编辑 |

#### AI 润色选项

```
┌──────────────────────────────┐
│  选择 AI 操作：                │
│                               │
│  ✨ 润色（保持原意，优化表达）   │
│  📝 扩写（补充细节）            │
│  ✂️ 缩写（精简内容）            │
│  🔄 重写（重新组织）            │
│  💬 自定义指令：[           ]  │
│                               │
│  [执行]  [取消]                │
└──────────────────────────────┘
```

#### AI 上下文策略

当 AI 生成或重写某个 Section 时，注入以下上下文：

```
系统 prompt：你是学术论文写作助手，当前正在写 [模板名] 论文的 [章节名]...

上下文信息：
- 论文标题和要求
- 当前章节的目标字数
- 上一章节内容（如果有）
- 下一章节内容（如果有）
- 当前章节已有内容（如果是润色/重写）
```

只注入相邻章节（上一个 + 下一个），而非全部章节。理由：
- 控制 token 消耗
- 相邻章节提供足够的衔接上下文
- 避免上下文过长导致 LLM 注意力分散

### 3.4 AI 生成策略（串行 + 详细规划）

不用复杂的多 Agent 并发，改为 **Coordinator 规划 + 串行执行**：

```
步骤 1：Coordinator 生成写作计划
  输入：题目、要求、模板结构、目标字数
  输出：每个章节的详细写作指令（内容要点、字数、风格要求）

步骤 2：按章节顺序串行生成
  每个章节生成时，注入：
  - Coordinator 给出的写作指令
  - 已生成的上一章节内容（保持衔接）
  
  前端实时显示：哪个章节正在生成（进度条）

步骤 3：全部生成完毕，用户进入编辑模式
```

#### 为什么串行而非并发？

- 串行时每章可参考上一章内容，保证论文连贯性
- 并发生成的章节之间容易内容重复或矛盾
- 串行的代码复杂度低 10 倍，调试容易
- 每章生成只需几秒，总时间可接受（8 章 × 5 秒 = 40 秒）

### 3.5 参考文献

**方案：用户手动收集 + 系统校验**

AI 生成论文内容时，不生成具体参考文献（因为会编造）。取而代之：

1. AI 在生成每个章节时，输出**建议搜索的关键词**（如"logistic 回归 数学建模"）
2. 前端「参考文献」面板提供两个跳转链接：
   - [知网搜索](https://www.cnki.net/) — 中文文献
   - [Google Scholar](https://scholar.google.com/) — 英文文献
3. 用户在外部搜索后，手动添加参考文献到列表：

```typescript
interface Reference {
  id: string;
  order: number;       // [1], [2], [3]...
  content: string;     // 完整的引用文本，如 "张三. 数学建模方法[M]. 北京: 清华大学出版社, 2020."
}
```

4. 导出 PDF 前，系统检查参考文献列表：
   - 如果为空，弹出警告："尚未添加参考文献，确定导出？"（允许但警告）
   - 参考文献自动渲染为标准格式

### 3.6 图片上传

**方案：用户手动上传 + 在编辑器中指定位置**

流程：
1. 用户在某个 Section 的编辑器中，点击工具栏的「插入图片」按钮
2. 选择本地图片文件上传（支持 PNG / JPG / SVG，单张 ≤ 5MB）
3. 图片上传至后端，存储在论文的 work_dir 中
4. 编辑器光标位置自动插入 Markdown 图片语法：`![图片描述](images/xxx.png)`
5. 编辑器预览区实时显示图片
6. 编译 PDF 时，Pandoc 自动解析图片路径嵌入 PDF

**AI 建议**：AI 生成章节内容时，会在适当位置插入图片占位提示：

```markdown
> 💡 建议在此处插入图表：展示模型拟合结果的折线图/散点图
```

用户看到提示后，可以自行准备图片并替换占位符。

### 3.7 PDF 导出

```
用户点击「导出 PDF」
       │
       ▼
  后端拼接所有 section 的 Markdown
  （按 order 排序，拼接参考文献）
       │
       ▼
  pandoc merged.md \
    --pdf-engine=typst \
    --template=模板.typ \
    -V title="xxx" \
    -V team_id="xxx" \
    --resource-path=work_dir \
    -o paper.pdf
       │
       ▼
  返回 PDF 文件（< 2 秒）
```

### 3.8 PDF 预览

- 手动触发：用户点击「预览」按钮
- 后端编译 PDF 后返回，前端用 iframe 或 react-pdf 渲染
- 预览面板在右侧，可折叠/展开

### 3.9 不做的功能（明确排除）

| 功能 | 排除理由 |
|------|---------|
| DOCX 导出 | Pandoc 生成的 DOCX 格式兼容性不稳定，用户用 Word 打开可能乱码 |
| 用户登录系统 | 本地项目，不需要账户体系 |
| 版本回退 | 增加复杂度，MVP 不做 |
| 从 MD/DOCX 导入 | 优先级低，后期扩展 |
| AI 生成图表 | 需要代码执行沙箱，复杂度高，效果不稳定 |
| 多人协作 | 不做 |
| 移动端适配 | 仅桌面浏览器 |
| 用户自定义模板 | 影响输出稳定性 |

---

## 四、数据模型

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Paper      │ 1───N │   Section    │       │  Reference   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id           │       │ id           │       │ id           │
│ title        │       │ paper_id(FK) │       │ paper_id(FK) │
│ template_id  │       │ title        │       │ order        │
│ target_words │       │ order        │       │ content      │
│ metadata     │       │ content_md   │       │ created_at   │
│ requirements │       │ status       │       └─────────────┘
│ created_at   │       │ ai_instruction│
│ updated_at   │       │ created_at   │       ┌─────────────┐
└─────────────┘       │ updated_at   │       │   Image      │
                      └─────────────┘       ├─────────────┤
                                             │ id           │
                                             │ paper_id(FK) │
                                             │ filename     │
                                             │ original_name│
                                             │ path         │
                                             │ created_at   │
                                             └─────────────┘
```

### SQLAlchemy 模型

```python
class Paper(Base):
    __tablename__ = "papers"
    id: str              # UUID
    title: str
    template_id: str     # 关联模板
    target_words: int    # 目标字数
    metadata: JSON       # 封面字段 {"team_id": "12345", ...}
    requirements: str    # 用户输入的题目要求
    status: str          # "drafting" | "completed"
    created_at: datetime
    updated_at: datetime

class Section(Base):
    __tablename__ = "sections"
    id: str
    paper_id: str        # FK → Paper
    title: str           # "摘要"
    order: int           # 排序
    content_md: str      # Markdown 内容
    status: str          # "empty" | "generating" | "draft" | "confirmed"
    ai_instruction: str  # Coordinator 给的写作指令
    created_at: datetime
    updated_at: datetime

class Reference(Base):
    __tablename__ = "references"
    id: str
    paper_id: str
    order: int
    content: str         # 引用全文
    created_at: datetime

class Image(Base):
    __tablename__ = "images"
    id: str
    paper_id: str
    filename: str        # 存储文件名 (UUID.ext)
    original_name: str   # 原始文件名
    created_at: datetime
```

---

## 五、API 设计

### 论文

```
POST   /api/papers                    创建论文（选模板 + 填信息）
GET    /api/papers                    获取论文列表
GET    /api/papers/:id                获取论文详情（含所有 sections）
PUT    /api/papers/:id                更新论文信息（标题、封面字段等）
DELETE /api/papers/:id                删除论文
```

### 章节

```
GET    /api/papers/:id/sections       获取所有章节
POST   /api/papers/:id/sections       新增章节
PUT    /api/sections/:id              更新章节内容（手动编辑）
PUT    /api/sections/:id/order        调整排序
PUT    /api/sections/:id/status       更新状态（确认/解锁）
DELETE /api/sections/:id              删除章节
```

### AI 功能

```
POST   /api/papers/:id/plan           AI 生成写作计划（返回各章节指令）
POST   /api/sections/:id/generate     AI 生成章节内容（SSE 流式）
POST   /api/sections/:id/polish       AI 润色（SSE 流式）
       body: { action: "polish"|"expand"|"compress"|"rewrite"|"custom", instruction?: string }
```

### 图片

```
POST   /api/papers/:id/images         上传图片
GET    /api/papers/:id/images          获取图片列表
DELETE /api/images/:id                 删除图片
GET    /api/images/:id/file            获取图片文件
```

### 导出 & 预览

```
GET    /api/papers/:id/preview         编译并返回 PDF（预览）
GET    /api/papers/:id/export/pdf      编译并下载 PDF
```

### 模板

```
GET    /api/templates                  获取所有可用模板
GET    /api/templates/:id              获取模板详情（含预设章节结构）
```

### 参考文献

```
GET    /api/papers/:id/references      获取参考文献列表
POST   /api/papers/:id/references      添加参考文献
PUT    /api/references/:id             编辑参考文献
DELETE /api/references/:id             删除参考文献
PUT    /api/papers/:id/references/order  调整参考文献顺序
```

### 设置

```
GET    /api/settings                   获取 LLM 设置
PUT    /api/settings                   更新 LLM 设置（API Key、模型选择等）
```

---

## 六、前端页面 & 布局

### 页面路由

```
/                         首页 — 论文列表 + 新建论文入口
/papers/new               新建论文向导（选模板 → 填信息 → 生成大纲）
/papers/:id/edit          论文编辑主界面（核心页面）
/settings                 设置页（LLM API Key 配置）
```

### 论文编辑主界面布局（三栏可折叠）

```
┌──────┬────────────────────────────┬──────────────────┐
│      │                            │                  │
│ 左栏  │        中栏（主编辑区）      │   右栏            │
│      │                            │                  │
│ 论文  │  ┌──────────────────────┐  │  PDF 预览         │
│ 大纲  │  │ § 摘要    [AI润色][✓] │  │  (iframe)        │
│      │  │                      │  │                  │
│ 摘要  │  │  Markdown 编辑器     │  │  [刷新预览]       │
│ 问题  │  │  (当前选中的章节)     │  │                  │
│ 重述  │  │                      │  │  ─────────       │
│ 问题  │  │                      │  │                  │
│ 分析  │  └──────────────────────┘  │  AI 对话          │
│ 模型  │                            │  (当前章节)       │
│ 建立  │  封面信息 | 参考文献 (tab)   │                  │
│ ...  │                            │  用户: 扩写这段    │
│      │                            │  AI: 好的...      │
│ 参考  │                            │                  │
│ 文献  │                            │  [发送消息]       │
│      │                            │                  │
├──────┤                            ├──────────────────┤
│[导出] │                            │ [折叠/展开]       │
└──────┴────────────────────────────┴──────────────────┘

比例：  ~200px     ~自适应 flex:1          ~400px
        可折叠      始终显示               可折叠
```

**交互要点**：
- 左栏点击章节名 → 中栏切换到该章节的编辑器
- 左栏章节名旁显示状态图标（空白 / 生成中 / 草稿 / 已确认）
- 左栏章节支持拖拽排序
- 右栏上半部分 PDF 预览，下半部分 AI 对话（可调整分割线）
- 右栏可整体折叠，给编辑区更多空间

### 新建论文向导（Step 组件）

```
Step 1: 选择模板
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ 📋 数模竞赛│  │ 📋 通用学术│  │ 📋 美赛   │  ...
  │  (国赛)   │  │  论文     │  │ (MCM/ICM)│
  └──────────┘  └──────────┘  └──────────┘

Step 2: 填写信息
  论文标题：[                              ]
  目标字数：[  8000  ] 字
  题目要求：[                              ]
           [          多行文本框            ]
  封面信息：（根据模板动态渲染字段）
    参赛队号：[         ]

Step 3: 确认章节结构
  ☑ 摘要        (~400字, 5%)
  ☑ 问题重述     (~400字, 5%)
  ☑ 问题分析     (~800字, 10%)
  ☑ 模型假设     (~400字, 5%)
  ☑ 符号说明     (~300字, 4%)
  ☑ 模型建立与求解 (~3200字, 40%)
  ☑ 模型检验     (~800字, 10%)
  ☑ 模型评价与推广 (~800字, 10%)
  ☑ 参考文献     (手动添加)
  ☐ 附录        (可选)
  [+ 添加自定义章节]

  [开始生成]
```

---

## 七、Typst 模板结构

模板文件放在后端 `templates/` 目录下：

```
backend/
  templates/
    math-modeling-cn/
      template.typ       # Typst 模板主文件
      fonts/              # 字体文件（宋体、黑体等）
    general-academic/
      template.typ
      fonts/
    mcm-icm/
      template.typ
```

### 模板文件示例（数模竞赛）

```typst
// template.typ — 数学建模竞赛模板

#let conf(
  title: "",
  team_id: "",
  body,
) = {
  // 页面设置
  set page(paper: "a4", margin: (top: 2.54cm, bottom: 2.54cm, left: 3.17cm, right: 3.17cm))
  set text(font: ("Times New Roman", "SimSun"), size: 12pt, lang: "zh")
  set par(leading: 1.5em, first-line-indent: 2em)
  set heading(numbering: "一、")
  set math.equation(numbering: "(1)")

  // 封面
  page(header: none, footer: none)[
    #align(center + horizon)[
      #text(size: 26pt, weight: "bold")[全国大学生数学建模竞赛论文]
      #v(2em)
      #text(size: 18pt, weight: "bold")[#title]
      #v(4em)
      #text(size: 14pt)[参赛队号：#team_id]
    ]
  ]

  // 正文页面设置
  set page(
    header: align(right, text(size: 9pt, fill: gray)[#title]),
    footer: align(center)[#counter(page).display()],
  )
  counter(page).update(1)

  body
}
```

### 中文字体问题

Docker 镜像中需要包含中文字体。方案：
- 在 Dockerfile 中安装 `fonts-noto-cjk`（Google Noto 字体，开源免费）
- 或将宋体/黑体字体文件放在模板目录的 `fonts/` 下

---

## 八、Docker 部署方案

### 目录结构

```
docker-compose.yml
frontend/
  Dockerfile
  nginx.conf
backend/
  Dockerfile
  requirements.txt
  ...
```

### docker-compose.yml

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - paper_data:/app/data       # SQLite + 用户上传的图片
    environment:
      - DATABASE_URL=sqlite:///data/paper.db

volumes:
  paper_data:
```

### 后端 Dockerfile

```dockerfile
FROM python:3.12-slim

# 安装 Pandoc
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates fonts-noto-cjk \
    && wget -qO pandoc.deb https://github.com/jgm/pandoc/releases/download/3.6.4/pandoc-3.6.4-1-amd64.deb \
    && dpkg -i pandoc.deb && rm pandoc.deb

# 安装 Typst
RUN wget -qO- https://github.com/typst/typst/releases/download/v0.13.1/typst-x86_64-unknown-linux-musl.tar.xz \
    | tar xJ --strip-components=1 -C /usr/local/bin/

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**镜像预估体积**：Python slim (~150MB) + Pandoc (~30MB) + Typst (~30MB) + 字体 (~50MB) + 依赖 (~50MB) ≈ **~310MB**

### 前端 Dockerfile

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 九、项目目录结构

```
paperAgent/
├── docker-compose.yml
├── README.md
│
├── frontend/                     # React 前端
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .eslintrc.cjs
│   ├── .prettierrc
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/               # 路由配置
│       │   └── index.tsx
│       │
│       ├── pages/
│       │   ├── Home/             # 论文列表
│       │   │   └── index.tsx
│       │   ├── PaperNew/         # 新建向导
│       │   │   ├── index.tsx
│       │   │   ├── TemplateSelect.tsx
│       │   │   ├── PaperInfo.tsx
│       │   │   └── SectionConfig.tsx
│       │   ├── PaperEdit/        # 编辑主界面
│       │   │   ├── index.tsx
│       │   │   ├── OutlineSidebar.tsx    # 左栏大纲
│       │   │   ├── SectionEditor.tsx     # 中栏编辑器
│       │   │   ├── PdfPreview.tsx        # 右栏预览
│       │   │   ├── AiChat.tsx            # 右栏对话
│       │   │   ├── ReferencePanel.tsx    # 参考文献面板
│       │   │   └── CoverPanel.tsx        # 封面信息面板
│       │   └── Settings/         # 设置页
│       │       └── index.tsx
│       │
│       ├── components/           # 通用组件
│       │   ├── MarkdownEditor/   # Markdown 编辑器封装
│       │   ├── ImageUpload/      # 图片上传组件
│       │   └── PolishModal/      # AI 润色选项弹窗
│       │
│       ├── stores/               # Zustand 状态
│       │   ├── paperStore.ts     # 论文 & 章节状态
│       │   ├── settingsStore.ts  # LLM 配置
│       │   └── uiStore.ts        # 面板折叠等 UI 状态
│       │
│       ├── services/             # API 调用层
│       │   ├── api.ts            # axios 实例
│       │   ├── paperApi.ts
│       │   ├── sectionApi.ts
│       │   ├── aiApi.ts          # SSE 流式调用
│       │   └── exportApi.ts
│       │
│       ├── types/                # TypeScript 类型定义
│       │   └── index.ts
│       │
│       └── utils/
│           └── index.ts
│
├── backend/                      # Python 后端
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   └── app/
│       ├── main.py               # FastAPI 入口
│       ├── config.py             # 配置（数据库路径等）
│       │
│       ├── models/               # SQLAlchemy 模型
│       │   ├── __init__.py
│       │   ├── paper.py
│       │   ├── section.py
│       │   ├── reference.py
│       │   └── image.py
│       │
│       ├── routers/              # API 路由
│       │   ├── __init__.py
│       │   ├── papers.py
│       │   ├── sections.py
│       │   ├── ai.py             # AI 生成 & 润色
│       │   ├── export.py         # PDF 导出
│       │   ├── images.py
│       │   ├── references.py
│       │   ├── templates.py
│       │   └── settings.py
│       │
│       ├── services/             # 业务逻辑
│       │   ├── __init__.py
│       │   ├── llm_service.py    # LiteLLM 封装
│       │   ├── paper_service.py
│       │   ├── export_service.py # Pandoc + Typst 调用
│       │   └── image_service.py
│       │
│       ├── templates/            # Typst 模板
│       │   ├── math-modeling-cn/
│       │   │   ├── template.typ
│       │   │   └── fonts/
│       │   ├── general-academic/
│       │   │   ├── template.typ
│       │   │   └── fonts/
│       │   └── template_registry.py  # 模板注册 & 元数据
│       │
│       └── database/
│           ├── __init__.py
│           └── connection.py     # SQLite 连接
│
└── data/                         # 运行时数据（gitignore）
    ├── paper.db                  # SQLite 数据库
    └── papers/                   # 每篇论文的工作目录
        └── {paper_id}/
            └── images/           # 上传的图片
```

---

## 十、开发计划（分阶段）

### Phase 1：基础骨架（~2-3 天 vibe coding）

- [ ] 初始化前端项目（React + Vite + Ant Design + TypeScript）
- [ ] 初始化后端项目（FastAPI + SQLAlchemy + SQLite）
- [ ] docker-compose 基础配置
- [ ] 数据库模型 & 迁移
- [ ] 模板注册系统（硬编码 2 个模板的元数据）
- [ ] 论文 CRUD API
- [ ] 前端首页（论文列表 + 新建入口）
- [ ] 新建论文向导页面（选模板 → 填信息 → 章节结构）

### Phase 2：编辑器核心（~2-3 天）

- [ ] 论文编辑主页面三栏布局
- [ ] 左栏大纲侧边栏（章节列表 + 状态 + 拖拽排序）
- [ ] 中栏 Markdown 编辑器（集成 @uiw/react-md-editor）
- [ ] 章节切换 & 状态管理（Zustand）
- [ ] 章节手动编辑 & 保存 API
- [ ] 封面信息编辑面板
- [ ] 参考文献面板（增删改查 + 知网/Google Scholar 链接）

### Phase 3：AI 生成（~2-3 天）

- [ ] LLM 设置页面（API Key 输入、模型选择）
- [ ] LiteLLM 服务封装
- [ ] Coordinator：AI 生成写作计划
- [ ] AI 串行生成各章节内容（SSE 流式输出）
- [ ] 前端流式渲染（逐字显示）
- [ ] AI 润色功能（润色/扩写/缩写/重写/自定义）
- [ ] AI 对话面板（针对当前章节）

### Phase 4：PDF 导出（~1-2 天）

- [ ] 数模竞赛 Typst 模板编写
- [ ] 通用学术论文 Typst 模板编写
- [ ] Export Service（Markdown → Pandoc → Typst → PDF）
- [ ] PDF 预览面板（右栏 iframe）
- [ ] PDF 下载接口

### Phase 5：图片 & 打磨（~1-2 天）

- [ ] 图片上传 API & 存储
- [ ] 编辑器中插入图片
- [ ] Markdown 图片在 PDF 中正确渲染
- [ ] Docker 完整打包 & 测试
- [ ] README 使用文档
- [ ] 边界情况处理 & 错误提示优化

### 总计预估：~8-13 天 vibe coding

---

## 十一、关键技术细节

### SSE 流式输出实现

**后端**（FastAPI）：
```python
@router.post("/sections/{section_id}/generate")
async def generate_section(section_id: str):
    async def event_stream():
        async for chunk in llm_service.stream_generate(...):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**前端**（fetch + ReadableStream）：
```typescript
const response = await fetch(`/api/sections/${id}/generate`, { method: 'POST' });
const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // 解析 SSE data: 行，更新编辑器内容
}
```

### Pandoc + Typst 调用

```python
import subprocess

def compile_pdf(paper_dir: str, template_path: str, variables: dict) -> bytes:
    md_path = os.path.join(paper_dir, "merged.md")
    pdf_path = os.path.join(paper_dir, "output.pdf")
    
    cmd = [
        "pandoc", md_path,
        "-o", pdf_path,
        "--pdf-engine=typst",
        f"--template={template_path}",
        f"--resource-path={paper_dir}",
    ]
    for key, value in variables.items():
        cmd.extend(["-V", f"{key}={value}"])
    
    subprocess.run(cmd, check=True, capture_output=True)
    
    with open(pdf_path, "rb") as f:
        return f.read()
```

### LiteLLM 配置

用户在设置页面填写：
```json
{
  "api_key": "sk-xxx",
  "model": "deepseek/deepseek-chat",   // 或 "gpt-4o", "claude-3.5-sonnet" 等
  "base_url": "https://api.deepseek.com"  // 可选，用于自定义端点
}
```

配置存储在 SQLite 的 settings 表中（本地存储，不上传）。

---

## 十二、风险 & 应对

| 风险 | 应对方案 |
|------|---------|
| Pandoc + Typst 渲染中文有问题 | Docker 中预装 Noto CJK 字体；模板中明确指定字体 fallback |
| LLM 生成的 Markdown 格式不规范 | 编译前做一次 Markdown 清洗（修复未闭合的代码块、公式等） |
| LLM 生成内容太短/太长 | 在 prompt 中明确字数要求，生成后检查字数并提示用户 |
| Typst 模板编写复杂 | 参考 Typst Universe 上的现有学术模板，在其基础上修改 |
| Docker 镜像太大 | 使用 multi-stage build，最终镜像控制在 ~300MB |
| Pandoc 不支持某些 Typst 特性 | 需要测试 Pandoc → Typst 的兼容性，必要时在 Markdown 中避免使用不兼容语法 |
