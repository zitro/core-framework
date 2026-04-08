import json
import logging
from pathlib import Path

from app.config import settings
from app.providers.blob.base import BlobProvider

logger = logging.getLogger(__name__)


class LocalBlobProvider(BlobProvider):
    """File-based blob storage for local development."""

    def __init__(self):
        self.base_path = Path(settings.local_storage_path).resolve() / "blobs"
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _blob_path(self, container: str, blob_name: str) -> Path:
        path = self.base_path / container
        path.mkdir(parents=True, exist_ok=True)
        return path / blob_name

    async def upload(
        self,
        container: str,
        blob_name: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        path = self._blob_path(container, blob_name)
        path.write_bytes(data)
        meta_path = path.with_suffix(path.suffix + ".meta")
        meta_path.write_text(json.dumps({"content_type": content_type}), encoding="utf-8")
        return str(path)

    async def download(self, container: str, blob_name: str) -> bytes:
        path = self._blob_path(container, blob_name)
        if not path.exists():
            raise FileNotFoundError(f"Blob {container}/{blob_name} not found")
        return path.read_bytes()

    async def delete(self, container: str, blob_name: str) -> bool:
        path = self._blob_path(container, blob_name)
        if path.exists():
            path.unlink()
            meta_path = path.with_suffix(path.suffix + ".meta")
            if meta_path.exists():
                meta_path.unlink()
            return True
        return False

    async def list_blobs(self, container: str, prefix: str | None = None) -> list[str]:
        container_path = self.base_path / container
        if not container_path.exists():
            return []
        blobs = []
        for f in container_path.iterdir():
            if f.suffix == ".meta":
                continue
            if prefix and not f.name.startswith(prefix):
                continue
            blobs.append(f.name)
        return blobs
