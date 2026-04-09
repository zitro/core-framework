import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.utils.local_docs import scan_docs, validate_docs_path

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class ScanRequest(BaseModel):
    path: str


class DocFile(BaseModel):
    name: str
    size: int
    extension: str


class ScanResponse(BaseModel):
    path: str
    files: list[DocFile]
    total_size: int


@router.post("/scan", response_model=ScanResponse)
async def scan_directory(request: ScanRequest):
    """Validate a local directory and list readable doc files."""
    validated = validate_docs_path(request.path)
    files = scan_docs(request.path)
    total = sum(f["size"] for f in files)
    return ScanResponse(
        path=str(validated),
        files=[DocFile(**f) for f in files],
        total_size=total,
    )
