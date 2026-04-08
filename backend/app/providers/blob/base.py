from abc import ABC, abstractmethod


class BlobProvider(ABC):
    """Abstract base for binary/file storage (transcripts, exports, attachments)."""

    @abstractmethod
    async def upload(self, container: str, blob_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload a blob and return its URL."""

    @abstractmethod
    async def download(self, container: str, blob_name: str) -> bytes:
        """Download a blob's contents."""

    @abstractmethod
    async def delete(self, container: str, blob_name: str) -> bool:
        """Delete a blob."""

    @abstractmethod
    async def list_blobs(self, container: str, prefix: str | None = None) -> list[str]:
        """List blob names, optionally filtered by prefix."""
