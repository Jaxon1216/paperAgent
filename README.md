# PaperAgent — AI 学术论文生成平台

> 输入标题和要求，AI 帮你自动规划结构、逐章生成、润色修改，最终导出排版精美的 PDF。

---

## 功能一览

- **模板系统** — 内置「数模竞赛（国赛）」「通用学术论文」等模板，自动套用对应的 Typst 排版格式
- **AI 规划大纲** — 根据论文标题和要求，自动拆分章节结构，生成每章写作指令
- **逐章生成 & 一键全文** — 可以逐章节生成，也可以一键生成全文（正文优先，摘要最后）
- **Markdown 编辑器** — 每个章节独立编辑，支持实时预览
- **AI 润色 & 对话** — 对已有内容进行扩写、精简、重写、自定义润色，还可与 AI 就论文内容对话
- **参考文献管理** — 手动添加 / AI 提取关键词辅助检索
- **PDF 导出** — 基于 Pandoc + Typst 的高质量 PDF 编译，支持中文
- **自由选择模型** — 通过 LiteLLM 接入 DeepSeek、GPT-4o、Claude 等任意大模型，填入你自己的 API Key 即可

---

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Ant Design + Zustand |
| 后端 | Python + FastAPI + SQLAlchemy (async) + SQLite |
| AI | LiteLLM（支持 OpenAI / Anthropic / DeepSeek 等） |
| PDF | Pandoc + Typst |
| 部署 | Docker Compose（Nginx + Uvicorn） |

---

## 快速开始

### 方式一：Docker 一键部署（推荐）

> 只需安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，无需配置 Python / Node.js 环境。

**1. 下载项目**

点击页面上方绿色的 **Code** 按钮 → **Download ZIP**，解压到任意位置。

或者，如果你安装了 Git：

```bash
git clone https://github.com/你的用户名/paperAgent.git
cd paperAgent
```

**2. 启动服务**

在项目根目录打开终端（Windows 可以在文件夹地址栏输入 `cmd` 回车），运行：

```bash
docker compose up --build
```

首次构建需要下载依赖，大约 5–10 分钟，之后再启动只需几秒。

**3. 打开浏览器**

访问 **http://localhost:3000** 即可使用。

**4. 配置 AI 模型**

进入页面后，点击右上角 **设置**，填写：

- **API Key**：你的大模型服务商提供的密钥（如 DeepSeek、OpenAI 等）
- **模型**：从预设列表选择，或切换为自定义输入（格式如 `deepseek/deepseek-chat`）
- **Base URL**（可选）：如果使用第三方代理或自建服务，填写完整地址

填好后点击 **验证连接** 确认可用，再点 **保存设置**。

**5. 停止服务**

在终端按 `Ctrl + C`，或运行：

```bash
docker compose down
```

你的论文数据保存在 Docker 卷中，下次启动仍会保留。

---

### 方式二：本地开发运行

适合需要修改代码的开发者。

**环境要求：**

- Python 3.12+
- Node.js 20+（推荐使用 [pnpm](https://pnpm.io/) 作为包管理器）
- Pandoc 3.x 和 Typst 0.13+（仅在需要导出 PDF 时才需要）

**1. 启动后端**

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端默认监听 `http://localhost:8000`，数据库文件自动创建在 `backend/data/paper.db`。

**2. 启动前端**

新开一个终端：

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认监听 `http://localhost:5173`，已配置好代理，会自动把 `/api` 请求转发到后端。

**3. 打开浏览器**

访问 **http://localhost:5173** 开始使用。

---

## 使用流程

```
新建论文 → 选择模板 → 填写标题 & 要求
    ↓
AI 规划大纲 → 调整章节顺序 / 增删章节
    ↓
AI 生成写作指令 → 可手动修改每章要求
    ↓
逐章生成 / 一键生成全文
    ↓
编辑 & 润色 → AI 对话微调
    ↓
添加参考文献 → 导出 PDF
```

---

## 项目结构

```
paperAgent/
├── docker-compose.yml          # Docker 编排配置
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt        # Python 依赖
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── config.py           # 配置（数据库路径等）
│       ├── database/           # 数据库连接 & 初始化
│       ├── models/             # 数据模型（论文、章节、参考文献等）
│       ├── routers/            # API 路由
│       ├── services/           # LLM 调用、PDF 导出等核心服务
│       └── templates/          # Typst 排版模板
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # 生产环境 Nginx 配置
    ├── package.json
    └── src/
        ├── pages/              # 页面组件（首页、新建、编辑、设置）
        ├── services/           # API 调用封装
        ├── stores/             # Zustand 状态管理
        └── types/              # TypeScript 类型定义
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库连接地址 | `sqlite+aiosqlite:///backend/data/paper.db` |

Docker 部署时由 `docker-compose.yml` 自动设置，本地开发通常无需手动配置。

如需自定义，可在项目根目录创建 `.env` 文件：

```env
DATABASE_URL=sqlite+aiosqlite:///你的路径/paper.db
```

---

## 常见问题

### Q: PDF 导出报错 / 找不到 Pandoc？

本地开发需要手动安装 Pandoc 和 Typst：
- Pandoc：https://pandoc.org/installing.html
- Typst：https://github.com/typst/typst/releases

Docker 部署已自动包含，无需额外安装。

### Q: 中文 PDF 显示乱码？

需要系统安装 Noto CJK 字体。Docker 镜像中已包含 `fonts-noto-cjk`。

macOS 一般无此问题；Linux 可通过包管理器安装：

```bash
# Ubuntu / Debian
sudo apt install fonts-noto-cjk
```

### Q: 如何使用 DeepSeek 模型？

1. 前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并获取 API Key
2. 在设置页面填入 API Key，模型选择 `DeepSeek Chat`（即 `deepseek/deepseek-chat`）
3. Base URL 留空即可（LiteLLM 会自动路由）

### Q: 支持哪些模型？

通过 [LiteLLM](https://docs.litellm.ai/docs/providers) 支持 100+ 模型，包括但不限于：
- DeepSeek（deepseek-chat）
- OpenAI（gpt-4o、gpt-4o-mini）
- Anthropic（claude-3.5-sonnet、claude-3-haiku）
- 以及任何兼容 OpenAI API 格式的服务

### Q: 数据保存在哪里？

- Docker 部署：保存在名为 `paper_data` 的 Docker 卷中
- 本地开发：保存在 `backend/data/paper.db`（SQLite 数据库文件）

---

## License

MIT
