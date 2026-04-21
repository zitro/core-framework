"""Markdown renderers for engagement-repo export.

Kept in a separate module so `routers/engagement.py` stays focused on
HTTP handling and under the project's 300-line file budget.
"""

from __future__ import annotations


def render_problem_statement(ps: dict, discovery: str, date: str) -> str:
    return (
        f"---\n"
        f'title: "Problem Statement v{ps.get("version", 1)}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# Problem Statement v{ps.get('version', 1)}\n\n"
        f"| Dimension | Detail |\n"
        f"| --------- | ------ |\n"
        f"| Who | {ps.get('who', '')} |\n"
        f"| What | {ps.get('what', '')} |\n"
        f"| Why | {ps.get('why', '')} |\n"
        f"| Impact | {ps.get('impact', '')} |\n\n"
        f"## Statement\n\n"
        f"{ps.get('statement', '')}\n"
    )


def render_use_case(uc: dict, discovery: str, date: str) -> str:
    metrics = uc.get("success_metrics", [])
    metrics_md = "\n".join(f"- {m}" for m in metrics) if metrics else "- TBD"
    return (
        f"---\n"
        f'title: "{uc.get("title", "Use Case")}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# {uc.get('title', 'Use Case')}\n\n"
        f"**Persona:** {uc.get('persona', '')}\n\n"
        f"**Goal:** {uc.get('goal', '')}\n\n"
        f"## Current State\n\n{uc.get('current_state', '')}\n\n"
        f"## Desired State\n\n{uc.get('desired_state', '')}\n\n"
        f"## Business Value\n\n{uc.get('business_value', '')}\n\n"
        f"## Business Impact\n\n{uc.get('business_impact', '')}\n\n"
        f"## Success Metrics\n\n{metrics_md}\n\n"
        f"## Summary\n\n{uc.get('summary', '')}\n"
    )


def render_blueprint(bp: dict, discovery: str, date: str) -> str:
    services = bp.get("services", [])
    svc_rows = "\n".join(
        f"| {s.get('service', '')} | {s.get('purpose', '')} | {s.get('rationale', '')} |"
        for s in services
    )
    svc_table = (
        "| Service | Purpose | Rationale |\n| ------- | ------- | --------- |\n" + svc_rows
        if services
        else "No services specified."
    )
    oq = bp.get("open_questions", [])
    oq_md = "\n".join(f"- {q}" for q in oq) if oq else "- None identified"
    fq = bp.get("follow_up_questions", [])
    fq_md = "\n".join(f"- {q}" for q in fq) if fq else "- None identified"
    providers = ", ".join(bp.get("target_providers", []))
    return (
        f"---\n"
        f'title: "{bp.get("approach_title", "Solution Blueprint")}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# {bp.get('approach_title', 'Solution Blueprint')}\n\n"
        f"**Target Providers:** {providers}\n\n"
        f"**Estimated Effort:** {bp.get('estimated_effort', 'TBD')}\n\n"
        f"## Approach\n\n{bp.get('approach_summary', '')}\n\n"
        f"## Recommended Services\n\n{svc_table}\n\n"
        f"## Architecture Overview\n\n"
        f"{bp.get('architecture_overview', '')}\n\n"
        f"## Quick Win\n\n{bp.get('quick_win_suggestion', '')}\n\n"
        f"## Open Questions\n\n{oq_md}\n\n"
        f"## Follow-up Questions\n\n{fq_md}\n"
    )


def _bullets(items: list, fallback: str = "- _none_") -> str:
    if not items:
        return fallback
    return "\n".join(f"- {x}" for x in items)


def render_company_profile(record: dict, discovery: str, date: str) -> str:
    result = record.get("result") or {}
    company = record.get("company") or result.get("company", "Company")
    sources = result.get("sources", [])
    src_md = (
        "\n".join(f"- [{s.get('title', s.get('url', ''))}]({s.get('url', '')})" for s in sources)
        or "- _none_"
    )
    news = result.get("recent_news", [])
    news_md = (
        "\n".join(
            f"- {n.get('title', '')} — [{n.get('url', '')}]({n.get('url', '')})"
            f"{' · ' + n.get('date', '') if n.get('date') else ''}"
            for n in news
        )
        or "- _none_"
    )
    return (
        f"---\n"
        f'title: "Company Profile — {company}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# {company}\n\n"
        f"**Industry:** {result.get('industry', '')}  \n"
        f"**Headquarters:** {result.get('headquarters', '')}  \n"
        f"**Size:** {result.get('size_estimate', '')}\n\n"
        f"## Summary\n\n{result.get('summary', '')}\n\n"
        f"## Strategic Priorities\n\n{_bullets(result.get('strategic_priorities', []))}\n\n"
        f"## Products & Services\n\n{_bullets(result.get('products_services', []))}\n\n"
        f"## Competitive Landscape\n\n{_bullets(result.get('competitive_landscape', []))}\n\n"
        f"## Recent News\n\n{news_md}\n\n"
        f"## Open Questions\n\n{_bullets(result.get('open_questions', []))}\n\n"
        f"## Sources\n\n{src_md}\n"
    )


def render_empathy_map(record: dict, discovery: str, date: str) -> str:
    result = record.get("result") or {}
    persona = result.get("persona") or record.get("persona") or "Persona"
    quadrants = ("says", "thinks", "does", "feels", "pains", "gains")
    sections = "".join(
        f"## {label.title()}\n\n{_bullets(result.get(label, []))}\n\n" for label in quadrants
    )
    return (
        f"---\n"
        f'title: "Empathy Map — {persona}"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# Empathy Map: {persona}\n\n"
        f"{sections}"
    )


def render_hmw_board(record: dict, discovery: str, date: str) -> str:
    result = record.get("result") or {}
    questions = result.get("hmw_questions") or result.get("questions") or []
    lines = []
    for q in questions:
        if isinstance(q, dict):
            text = q.get("text", "")
            theme = q.get("theme", "")
            prefix = f"**{theme}** — " if theme else ""
            lines.append(f"- {prefix}{text}")
        else:
            lines.append(f"- {q}")
    body = "\n".join(lines) or "- _none_"
    return (
        f"---\n"
        f'title: "How Might We Board"\n'
        f"date: {date}\n"
        f"type: decision\n"
        f'initiative: "{discovery}"\n'
        f"source: CORE Discovery Framework\n"
        f"---\n\n"
        f"# How Might We\n\n"
        f"{body}\n"
    )
