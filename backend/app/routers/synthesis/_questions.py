"""Customer-question endpoints (the QuestionAgent surface).

  POST /{project_id}/questions/refresh
  GET  /{project_id}/questions
"""

from __future__ import annotations

from app.synthesis.corpus import build_corpus
from app.synthesis.question_agent import QuestionAgent

from app.routers.synthesis._helpers import (
    load_project,
    project_artifacts,
    project_questions,
)
from app.routers.synthesis._router import router


@router.post("/{project_id}/questions/refresh")
async def refresh_questions(project_id: str) -> dict:
    """Regenerate the customer-questions list. LLM-backed; user-initiated."""
    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)
    corpus = await build_corpus(project)
    questions = await QuestionAgent().generate(project, artifacts, corpus)
    return {
        "project_id": project_id,
        "question_count": len(questions),
        "questions": [q.model_dump(mode="json") for q in questions],
    }


@router.get("/{project_id}/questions")
async def list_questions(project_id: str) -> dict:
    """Saved customer questions for the project."""
    await load_project(project_id)
    questions = await project_questions(project_id)
    return {"questions": [q.model_dump(mode="json") for q in questions]}
