from dataclasses import dataclass, field


@dataclass
class CoverField:
    key: str
    label: str
    required: bool = False
    placeholder: str = ""
    multiline: bool = False


@dataclass
class DefaultSection:
    title: str
    order: int
    description: str
    estimated_word_ratio: float
    is_required: bool = True


@dataclass
class Template:
    id: str
    name: str
    description: str
    language: str
    cover_fields: list[CoverField] = field(default_factory=list)
    default_sections: list[DefaultSection] = field(default_factory=list)
    typst_template: str = ""


TEMPLATES: dict[str, Template] = {
    "math-modeling-cn": Template(
        id="math-modeling-cn",
        name="数学建模竞赛（国赛）",
        description="全国大学生数学建模竞赛论文模板，包含标准章节结构和排版格式",
        language="zh",
        cover_fields=[
            CoverField(key="team_id", label="参赛队号", placeholder="请输入参赛队号"),
            CoverField(key="author", label="参赛成员", placeholder="每行一个姓名", multiline=True),
        ],
        default_sections=[
            DefaultSection(
                title="摘要",
                order=0,
                description="用 200-300 字概括论文的主要工作：问题背景、采用的方法、关键结论。需包含 3-5 个关键词。",
                estimated_word_ratio=0.05,
            ),
            DefaultSection(
                title="问题重述",
                order=1,
                description="用自己的语言重新描述题目背景和具体问题，体现对题目的理解。不要照抄原题。",
                estimated_word_ratio=0.05,
            ),
            DefaultSection(
                title="问题分析",
                order=2,
                description="分析问题的本质，梳理解题思路，明确需要解决的子问题。可以画流程图辅助说明。",
                estimated_word_ratio=0.10,
            ),
            DefaultSection(
                title="模型假设",
                order=3,
                description="列出建模过程中做出的合理假设，每条假设需有简要理由说明。",
                estimated_word_ratio=0.05,
            ),
            DefaultSection(
                title="符号说明",
                order=4,
                description="用表格列出论文中使用的主要数学符号及其含义和单位。",
                estimated_word_ratio=0.04,
            ),
            DefaultSection(
                title="模型建立与求解",
                order=5,
                description="详细描述数学模型的建立过程和求解方法。包括：模型推导、算法描述、计算结果。这是论文的核心章节。",
                estimated_word_ratio=0.40,
            ),
            DefaultSection(
                title="模型检验",
                order=6,
                description="对模型结果进行检验和验证，包括灵敏度分析、误差分析、与实际数据的对比等。",
                estimated_word_ratio=0.10,
            ),
            DefaultSection(
                title="模型评价与推广",
                order=7,
                description="总结模型的优点和不足，讨论模型的适用范围和推广方向。",
                estimated_word_ratio=0.10,
            ),
            DefaultSection(
                title="参考文献",
                order=8,
                description="列出论文引用的参考文献。",
                estimated_word_ratio=0.01,
                is_required=True,
            ),
            DefaultSection(
                title="附录",
                order=9,
                description="放置补充材料，如详细的推导过程、完整代码、大量数据表格等。",
                estimated_word_ratio=0.10,
                is_required=False,
            ),
        ],
        typst_template="math-modeling-cn/template.typ",
    ),
    "general-academic": Template(
        id="general-academic",
        name="通用学术论文",
        description="适用于校内课程论文、一般学术研究报告等场景的通用模板",
        language="zh",
        cover_fields=[
            CoverField(key="author", label="作者", placeholder="每行一个姓名", multiline=True),
            CoverField(key="institution", label="学校/机构", placeholder="请输入学校或机构名称"),
            CoverField(key="date", label="日期", placeholder="如 2026 年 3 月"),
        ],
        default_sections=[
            DefaultSection(
                title="摘要",
                order=0,
                description="用 150-300 字概括研究目的、方法、主要发现和结论。附 3-5 个关键词。",
                estimated_word_ratio=0.05,
            ),
            DefaultSection(
                title="引言",
                order=1,
                description="介绍研究背景、研究现状、研究目的和意义，说明论文的组织结构。",
                estimated_word_ratio=0.15,
            ),
            DefaultSection(
                title="相关工作",
                order=2,
                description="综述与本研究相关的已有工作，分析现有方法的优缺点，指出本研究的创新点。",
                estimated_word_ratio=0.15,
                is_required=False,
            ),
            DefaultSection(
                title="方法",
                order=3,
                description="详细描述研究采用的方法、技术路线或理论框架。",
                estimated_word_ratio=0.25,
            ),
            DefaultSection(
                title="实验与分析",
                order=4,
                description="展示实验设计、数据收集、结果分析。使用图表辅助说明。",
                estimated_word_ratio=0.25,
            ),
            DefaultSection(
                title="结论",
                order=5,
                description="总结主要研究发现，讨论研究局限性，提出未来研究方向。",
                estimated_word_ratio=0.10,
            ),
            DefaultSection(
                title="参考文献",
                order=6,
                description="列出论文引用的参考文献。",
                estimated_word_ratio=0.01,
                is_required=True,
            ),
        ],
        typst_template="general-academic/template.typ",
    ),
}


def get_all_templates() -> list[Template]:
    return list(TEMPLATES.values())


def get_template_by_id(template_id: str) -> Template | None:
    return TEMPLATES.get(template_id)
