#!/usr/bin/env python3
"""
JSONL(생성 문제) → 수능 시험지 스타일 HTML 변환기.

사용:
    python3 render_problems.py "입력.jsonl" "출력.html"

- 수식은 KaTeX(CDN)로 렌더 (LaTeX $...$, $$...$$)
- 보기 ①~⑤는 problem 본문에서 파싱하거나 choices 배열 사용
- difficulty → 배점(Basic 2 / Normal 3 / Advanced 4)으로 표기
- 문제별 '정답·해설' 토글 포함
"""
import json
import re
import sys
import html

CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩"
DIFF_POINT = {"Basic": 2, "Normal": 3, "Advanced": 4}


def has_inline_frac(stem):
    """문장 흐름($...$) 안에 분수가 있으면 True. display 블록($$...$$) 분수는 제외."""
    no_display = re.sub(r"\$\$.*?\$\$", "", stem, flags=re.DOTALL)
    for m in re.finditer(r"\$(.+?)\$", no_display, flags=re.DOTALL):
        if "\\dfrac" in m.group(1) or "\\frac" in m.group(1):
            return True
    return False


COND_RE = r"\((?:가|나|다|라|마|바|사)\)"


def render_cond_box(block):
    """(가)(나)... 조건 블록 → 테두리 박스. 각 조건 한 줄."""
    parts = re.split(r"(?=" + COND_RE + r")", block)
    rows = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"(" + COND_RE + r")\s*(.*)", p, re.DOTALL)
        lbl, body = (m.group(1), m.group(2).strip()) if m else ("", p)
        rows.append(
            f'<div class="cond"><span class="cond-label">{html.escape(lbl)}</span>'
            f'<span class="cond-body">{html.escape(body)}</span></div>'
        )
    return '<div class="cond-box">' + "".join(rows) + "</div>"


def render_stem(stem, point):
    """본문을 단락으로 나눠 렌더. (가)로 시작하는 단락은 조건 박스로,
    배점 [N점]은 마지막 텍스트 단락(=발문) 끝에 붙인다."""
    blocks = []

    def stash(m):
        blocks.append(m.group(0))
        return f"\x00{len(blocks) - 1}\x00"

    safe = re.sub(r"\$\$.*?\$\$", stash, stem, flags=re.DOTALL)  # display 수식 보호

    def restore(s):
        return re.sub(r"\x00(\d+)\x00", lambda mm: blocks[int(mm.group(1))], s)

    paras = [restore(p).strip() for p in re.split(r"\n\s*\n", safe) if p.strip()]
    kinds = ["box" if re.match(COND_RE, p) else "text" for p in paras]
    last_text = max((i for i, k in enumerate(kinds) if k == "text"), default=-1)

    out = []
    for i, (p, k) in enumerate(zip(paras, kinds)):
        if k == "box":
            out.append(render_cond_box(p))
        else:
            body = html.escape(p)
            if i == last_text:
                body += f' <span class="q-point">[{point}점]</span>'
            out.append(f'<div class="q-text">{body}</div>')
    if last_text == -1:
        out.append(f'<span class="q-point">[{point}점]</span>')
    return "\n".join(out)


def split_stem_and_choices(rec):
    """problem 본문에서 보기를 분리.
    ①~⑩(U+2460~U+2469) 마커 기준으로 자르므로 줄바꿈/인라인 모두 처리.
    choices 배열이 있으면 그걸 우선 사용."""
    problem = rec.get("problem", "")
    arr = rec.get("choices") or []

    markers = list(re.finditer(r"[①-⑩]", problem))
    if markers:
        stem = problem[: markers[0].start()].strip()
        inline = [
            p.strip()
            for p in re.split(r"[①-⑩]", problem[markers[0].start():])
            if p.strip()
        ]
    else:
        stem = problem.strip()
        inline = []

    choices = arr if arr else inline
    return stem, choices


def render(input_path, output_path):
    def full_size_frac(s):
        """\\frac(작은 분수) → \\dfrac(본문 크기 분수)로 치환해 분자·분모 크기 유지."""
        if not isinstance(s, str):
            return s
        return s.replace("\\dfrac", "\\frac").replace("\\frac", "\\dfrac")

    records = []
    with open(input_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            rec["problem"] = full_size_frac(rec.get("problem", ""))
            rec["explanation"] = full_size_frac(rec.get("explanation", ""))
            rec["choices"] = [full_size_frac(c) for c in (rec.get("choices") or [])]
            records.append(rec)

    cards = []
    for rec in records:
        stem, choices = split_stem_and_choices(rec)
        order = rec.get("order", "")
        point = DIFF_POINT.get(rec.get("difficulty", ""), 3)
        unit = rec.get("unit", "")
        subject = rec.get("subject", "")
        answer = rec.get("answer", "")
        final = rec.get("final", "")
        explanation = rec.get("explanation", "")

        choice_html = ""
        if choices:
            items = "".join(
                f'<span class="choice"><span class="cnum">{CIRCLED[i]}</span><span class="m">{html.escape(c)}</span></span>'
                for i, c in enumerate(choices)
            )
            choice_html = f'<div class="choices">{items}</div>'

        ans_circle = CIRCLED[int(final)-1] if str(final).isdigit() and 1 <= int(final) <= 10 else final
        stem_html = render_stem(stem, point)
        cards.append(f"""
      <article class="q">
        <div class="q-body">
          <span class="q-no">{order}.</span>
          <div class="q-stem">{stem_html}</div>
        </div>
        {choice_html}
        <button class="q-toggle" onclick="this.nextElementSibling.classList.toggle('open')">정답 · 해설 보기</button>
        <div class="q-sol">
          <div class="q-meta">{html.escape(subject)} · {html.escape(unit)} · {html.escape(rec.get('difficulty',''))}</div>
          <div class="q-ans">정답 <b>{ans_circle}</b> <span class="q-ansval">({html.escape(str(answer))})</span></div>
          <div class="q-exp">{html.escape(explanation)}</div>
        </div>
      </article>""")

    title = input_path.split("/")[-1].replace(".jsonl", "")
    doc = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{html.escape(title)} — 시험지</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<style>
  :root {{ --ink:#1a1a1a; --line:#d8d8d8; --paper:#fff; }}
  * {{ box-sizing:border-box; }}
  body {{
    margin:0; background:#ececec;
    font-family:"Noto Serif KR","Pretendard",serif;
    color:var(--ink); line-height:1.7; -webkit-font-smoothing:antialiased;
  }}
  .sheet {{
    max-width:760px; margin:32px auto; background:var(--paper);
    padding:56px 56px 72px; box-shadow:0 4px 24px rgba(0,0,0,.12);
  }}
  .sheet-head {{
    text-align:center; border-bottom:2px solid var(--ink);
    padding-bottom:14px; margin-bottom:30px;
  }}
  .sheet-head h1 {{ font-size:22px; margin:0 0 4px; letter-spacing:-.3px; }}
  .sheet-head p {{ font-size:13px; color:#666; margin:0; }}
  .q {{ padding:26px 0; border-bottom:1px solid #eee; }}
  .q-body {{ display:flex; gap:8px; align-items:baseline; }}
  .q-no {{ font-size:18px; font-weight:700; flex:0 0 auto; }}
  .q-stem {{ flex:1; font-size:16.5px; line-height:1.8; }}
  /* 인라인 분수가 든 '그 줄'만 line-height 확대 (다른 줄은 그대로) */
  .q-stem .katex:has(.mfrac) {{ line-height:2.9; }}
  .q-stem .katex-display .katex {{ line-height:normal; }}  /* display 블록은 제외 */
  .q-text + .q-text {{ margin-top:.5em; }}
  /* 수능 조건 박스 (가)(나) */
  .cond-box {{ border:1px solid #333; border-radius:2px; padding:16px 26px; margin:20px 0 22px; }}
  .cond {{ display:flex; gap:9px; margin:9px 0; font-size:16.5px; }}
  .cond-label {{ flex:0 0 auto; }}
  .cond-body {{ flex:1; }}
  .cond-body .katex-display {{ padding-left:1.4em; margin:1.4em 0; }}
  .katex-display {{ margin:2.5em 0; text-align:left; padding-left:2.8em; }}
  .katex-display > .katex {{ text-align:left; }}
  .q-point {{ font-family:"Pretendard",sans-serif; font-size:.9em; color:#333; margin-left:4px; white-space:nowrap; }}
  .choices {{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px 24px; padding:0 6px 0 28px; margin-top:18px; }}
  .choice {{ display:flex; align-items:center; gap:7px; font-size:16px; }}
  .cnum {{ flex:0 0 auto; font-size:16px; line-height:1; }}
  .q-meta {{ font-family:"Pretendard",sans-serif; font-size:12px; color:#999; margin-bottom:10px; }}
  .q-toggle {{
    margin-top:18px; font-family:"Pretendard",sans-serif; font-size:13px;
    color:#c0392b; background:none; border:1px solid #e0c0bd; border-radius:6px;
    padding:6px 12px; cursor:pointer;
  }}
  .q-sol {{ display:none; margin-top:14px; padding:16px 18px; background:#faf7f2; border-radius:8px; }}
  .q-sol.open {{ display:block; }}
  .q-ans {{ font-size:15px; margin-bottom:10px; font-family:"Pretendard",sans-serif; }}
  .q-ans b {{ color:#c0392b; font-size:17px; }}
  .q-ansval {{ color:#888; font-size:13px; }}
  .q-exp {{ white-space:pre-wrap; font-size:15px; color:#333; }}
  .katex {{ font-size:1.04em; }}
  @media print {{
    body {{ background:#fff; }}
    .sheet {{ box-shadow:none; margin:0; max-width:none; }}
    .q-toggle {{ display:none; }}
    .q-sol {{ display:block !important; }}
  }}
</style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-head">
      <h1>{html.escape(title)}</h1>
      <p>Pullit · AI 생성 진단 세트 · 총 {len(records)}문항</p>
    </div>
    {''.join(cards)}
  </div>
<script>
  window.addEventListener('DOMContentLoaded', function () {{
    renderMathInElement(document.body, {{
      delimiters: [
        {{ left: '$$', right: '$$', display: true }},
        {{ left: '$', right: '$', display: false }}
      ],
      throwOnError: false
    }});
  }});
</script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"✓ {len(records)}문항 → {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("사용: python3 render_problems.py <입력.jsonl> <출력.html>")
        sys.exit(1)
    render(sys.argv[1], sys.argv[2])
