// Pandoc Typst Template — 通用学术论文
// Variables passed via pandoc -V: title, author, institution, date, heading_chinese

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
  margin: (top: 2.54cm, bottom: 2.54cm, left: 3cm, right: 3cm),
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
$if(heading_chinese)$
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
$else$
#set heading(numbering: "1.")
$endif$

#show heading.where(level: 1): it => {
  set text(size: 16pt, weight: "bold", font: ("Times New Roman", "Heiti SC", "SimHei", "Noto Sans CJK SC"))
  v(1em)
  it
  v(0.6em)
}

#show heading.where(level: 2): it => {
  set text(size: 14pt, weight: "bold", font: ("Times New Roman", "Heiti SC", "SimHei", "Noto Sans CJK SC"))
  v(0.6em)
  it
  v(0.4em)
}

#show heading.where(level: 3): it => {
  set text(size: 12pt, weight: "bold")
  v(0.4em)
  it
  v(0.2em)
}

// --- Cover page ---
$if(title)$
#page(header: none, footer: none, margin: (top: 2.54cm, bottom: 2.54cm, left: 3cm, right: 3cm))[
  #v(15%)
  #align(center)[
    #block(spacing: 2em)[
      #text(size: 22pt, weight: "bold", font: ("Heiti SC", "SimHei", "Noto Sans CJK SC"))[
        $title$
      ]
    ]
    #v(4em)
    $if(author)$
    #text(size: 14pt)[$author$]
    #v(1em)
    $endif$
    $if(institution)$
    #text(size: 14pt)[$institution$]
    #v(1em)
    $endif$
    $if(date)$
    #text(size: 14pt)[$date$]
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
