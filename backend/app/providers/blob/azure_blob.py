import logging

from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient

from app.config import settings
from app.providers.blob.base import BlobProvider

logger = logging.getLogger(__name__)


class AzureBlobProvider(BlobProvider):
    """Azure Blob Storage provider with Entra ID auth."""

    def __init__(self):
        account_url = f"https://{settings.azure_storage_account}.blob.core.windows.net"
        if settings.azure_storage_connection_string:
            self.client = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
        else:
            self.credential = DefaultAzureCredential()
            self.client = BlobServiceClient(account_url, credential=self.credential)

    async def upload(
        self,
        container: str,
        blob_name: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        container_client = self.client.get_container_client(container)
        blob_client = container_client.get_blob_client(blob_name)
        await blob_client.upload_blob(
            data, overwrite=True, content_settings=ContentSettings(content_type=content_type)
        )
        return blob_client.url

    async def download(self, container: str, blob_name: str) -> bytes:
        container_client = self.client.get_container_client(container)
        blob_client = container_client.get_blob_client(blob_name)
        stream = await blob_client.download_blob()
        return await stream.readall()

    async def delete(self, container: str, blob_name: str) -> bool:
        container_client = self.client.get_container_client(container)
        blob_client = container_client.get_blob_client(blob_name)
        try:
            await blob_client.delete_blob()
            return True
        except Exception:
            logger.debug("Failed to delete blob %s/%s", container, blob_name)
            return False

    async def list_blobs(self, container: str, prefix: str | None = None) -> list[str]:
        container_client = self.client.get_container_client(container)
        blobs = []
        async for blob in container_client.list_blobs(name_starts_with=prefix):
            blobs.append(blob.name)
        return blobs
