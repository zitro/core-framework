"""Prompt assembly for the synthesis subsystem."""

from __future__ import annotations

from app.synthesis.models import Corpus, SourceDoc
from app.synthesis.types import ArtifactType

SYSTEM_FRAME = """You are CORE, a Microsoft FDE-grade product strategist.
You synthesize structured artifacts from a project's corpus. You never invent
specifics that the corpus does not support. You always cite the source ids
you used. You write at the level of an executive memo: short, concrete,
honest about uncertainty. You do not use marketing language."""


CRITIC_FRAME = """You are CORE's Critic. You audit a draft artifact against
the corpus and the artifact's required schema. You score it 0.0–1.0 on
overall confidence and list issues by dimension:

  - grounding     : every concrete claim is traceable to a cited source
  - completeness  : every required schema field is meaningfully filled
  - clarity       : an executive could act on this without follow-up
  - contradiction : nothing here contradicts other artifacts in the project

Be terse. Issues are ordered most important first."""


QUESTION_FRAME = """You are CORE's Question agent. Given the current
artifact set and corpus, you list the customer questions worth asking next.
You only ask questions whose answers would unblock a specific missing or
weak artifact. You never ask things the corpus already answers."""


def render_corpus_block(corpus: Corpus, *, max_chars: int = 24_000) -> str:
    """Render the corpus as a token-bounded block the LLM can read."""
    blocks: list[str] = []
    used = 0
    for doc in corpus.docs:
        snippet = (doc.text or doc.snippet or "").strip()
        if not snippet:
            continue
        chunk = f"[source id={doc.id} kind={doc.kind.value} title={doc.title!r}]\n{snippet}\n"
        if used + len(chunk) > max_chars:
            blocks.append("[corpus truncated for length]")
            break
        blocks.append(chunk)
        used += len(chunk)
    if not blocks:
        return "[no corpus available]"
    return "\n---\n".join(blocks)


def render_schema_block(t: ArtifactType) -> str:
    if not t.body_schema:
        return "(no specific body fields required — use {} or a single 'content' field)"
    lines = [f"  - {k}: {v}" for k, v in t.body_schema.items()]
    return "\n".join(lines)


def generation_prompt(t: ArtifactType, corpus: Corpus, instructions: str = "") -> tuple[str, str]:
    """Return (system_prompt, user_prompt) for generating one artifact."""
    user = f"""ARTIFACT TYPE: {t.id}  ({t.label})
CATEGORY: {t.category.value}
DESCRIPTION: {t.description}

REQUIRED BODY FIELDS:
{render_schema_block(t)}

TYPE-SPECIFIC INSTRUCTION:
{t.prompt}

ADDITIONAL INSTRUCTIONS FROM USER:
{instructions or "(none)"}

CORPUS:
{render_corpus_block(corpus)}

Return strict JSON with this shape:
{{
  "title": "short artifact title",
  "summary": "1-3 sentence executive summary",
  "body": {{ ...fields matching REQUIRED BODY FIELDS above... }},
  "citations": [
    {{
      "source_id": "...",
      "quote": "verbatim excerpt from the source",
      "note": "why this supports the claim"
    }}
  ]
}}

Rules:
- Every concrete claim in 'summary' or 'body' must be supported by at least
  one citation.
- 'citations[].source_id' MUST be one of the source ids shown in the
  CORPUS block.
- If the corpus has no support for a field, write null (or empty list) and
  add a citation-free note in 'summary' explaining the gap.
- Do NOT invent customer names, numbers, or quotes."""
    return SYSTEM_FRAME, user


def critique_prompt(t: ArtifactType, artifact_body: dict, corpus: Corpus) -> tuple[str, str]:
    user = f"""ARTIFACT TYPE: {t.id}  ({t.label})

REQUIRED BODY FIELDS:
{render_schema_block(t)}

DRAFT ARTIFACT (JSON):
{artifact_body}

CORPUS (truncated):
{render_corpus_block(corpus, max_chars=12_000)}

Return strict JSON:
{{
  "score": 0.0,
  "issues": [
    {{
      "severity": "info|warn|blocker",
      "dimension": "grounding|completeness|clarity|contradiction",
      "message": "...",
      "field": "optional body field path"
    }}
  ]
}}"""
    return CRITIC_FRAME, user


def questions_prompt(
    artifacts: list[dict], corpus: Corpus, missing_type_ids: list[str]
) -> tuple[str, str]:
    summaries = []
    for a in artifacts:
        summaries.append(
            f"- {a.get('type_id')}: {a.get('title', '')}  — {a.get('summary', '')[:200]}"
        )
    artifact_block = "\n".join(summaries) if summaries else "(no artifacts yet)"
    missing_block = ", ".join(missing_type_ids) if missing_type_ids else "(none)"

    user = f"""CURRENT ARTIFACTS:
{artifact_block}

ARTIFACT TYPES MISSING ENTIRELY:
{missing_block}

CORPUS (truncated):
{render_corpus_block(corpus, max_chars=10_000)}

Return strict JSON:
{{
  "questions": [
    {{
      "text": "the question, phrased to ask the customer directly",
      "rationale": "why we need it",
      "target_artifact_type_id": "id of the artifact this would unblock (optional)",
      "priority": 1
    }}
  ]
}}

Rules:
- Maximum 12 questions.
- priority 1 = ask first. 5 = nice-to-have.
- Do NOT ask questions whose answers are already in the corpus."""
    return QUESTION_FRAME, user


def list_source_ids(corpus: Corpus) -> set[str]:
    return {d.id for d in corpus.docs}


def filter_citations(raw_citations: list[dict] | None, valid_ids: set[str]) -> list[dict]:
    """Drop citations that reference unknown source ids."""
    if not raw_citations:
        return []
    out: list[dict] = []
    for c in raw_citations:
        sid = str(c.get("source_id") or "")
        if sid in valid_ids:
            out.append(
                {
                    "source_id": sid,
                    "quote": str(c.get("quote") or "")[:500],
                    "note": str(c.get("note") or "")[:300],
                }
            )
    return out


def doc_to_brief(doc: SourceDoc) -> str:
    return f"{doc.id} :: {doc.title}"
