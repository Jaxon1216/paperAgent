// Pandoc Typst Template — 数学建模竞赛（国赛）
// Variables passed via pandoc -V: title, team_id, author, heading_arabic

#let horizontalrule = line(start: (25%,0%), end: (75%,0%))

#show terms.item: it => block(breakable: false)[
  #text(weight: "bold")[#it.term]
  #block(inset: (left: 1.5em, top: -0.4em))[#it.description]
]

#set table(inset: 6pt, stroke: 0.5pt)

#show figure.where(kind: table): set figure.caption(position: top)
#show figure.where(kind: image): set figure.caption(position: bottom)

$if(highlighting-definitions)$
$highlighting-definitions$
$endif$

// --- Page setup ---
#set page(
  paper: "a4",
  margin: (top: 2.54cm, bottom: 2.54cm, left: 3.17cm, right: 3.17cm),
)
#set text(
  font: ("Times New Roman", "Songti SC", "SimSun", "Noto Serif CJK SC"),
  size: 12pt,
  lang: "zh",
  region: "cn",
)
#set par(leading: 1.2em, first-line-indent: 2em, justify: true)
#set math.equation(numbering: "(1)")

// --- Heading numbering ---
$if(heading_arabic)$
#set heading(numbering: "1.")
$else$
#set heading(numbering: (..nums) => {
  let n = nums.pos()
  if n.len() == 1 {
    numbering("一、", ..n)
  } else if n.len() == 2 {
    str(n.last()) + "."
  } else if n.len() >= 3 {
    "(" + str(n.last()) + ")"
  }
})
$endif$

// Force first-line-indent on the first paragraph after headings (Chinese convention)
#show heading: it => {
  it
  par(text(size: 0.35em, h(0em)))
}

#show heading.where(level: 1): it => {
  set text(size: 15pt, weight: "bold", font: ("Times New Roman", "Heiti SC", "SimHei", "Noto Sans CJK SC"))
  v(0.8em)
  it
  v(0.5em)
}

#show heading.where(level: 2): it => {
  set text(size: 13pt, weight: "bold", font: ("Times New Roman", "Heiti SC", "SimHei", "Noto Sans CJK SC"))
  v(0.5em)
  it
  v(0.3em)
}

#show heading.where(level: 3): it => {
  set text(size: 12pt, weight: "bold")
  v(0.3em)
  it
  v(0.2em)
}

// --- Cover page ---
$if(title)$
#page(header: none, footer: none, margin: (top: 2.54cm, bottom: 2.54cm, left: 3.17cm, right: 3.17cm))[
  #v(15%)
  #align(center)[
    #block(spacing: 2em)[
      #text(size: 24pt, weight: "bold", font: ("Heiti SC", "SimHei", "Noto Sans CJK SC"))[
        全国大学生数学建模竞赛论文
      ]
    ]
    #v(2em)
    #block(spacing: 1.5em)[
      #text(size: 18pt, weight: "bold")[
        $title$
      ]
    ]
    #v(3em)
    $if(team_id)$
    #text(size: 14pt)[参赛队号：$team_id$]
    #v(1em)
    $endif$
    $if(author)$
    #text(size: 14pt)[参赛成员：$author$]
    $endif$
  ]
]
$endif$

// --- Body pages ---
#set page(
  header: align(right, text(size: 9pt, fill: gray)[$if(title)$$title$$endif$]),
  footer: align(center)[#context counter(page).display()],
)
#counter(page).update(1)

$if(toc)$
#outline(title: [目录], depth: 3)
#pagebreak()
$endif$

$body$
