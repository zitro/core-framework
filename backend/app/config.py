from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CORE Discovery API"
    debug: bool = False

    # Provider selection: "azure" | "local" | "openai"
    llm_provider: str = "local"
    storage_provider: str = "local"
    auth_provider: str = "none"
    speech_provider: str = "none"
    # "none" | "web" (alias for duckduckgo) | "duckduckgo" | "bing"
    search_provider: str = "none"
    # "none" | "msgraph"
    graph_provider: str = "none"
    # "none" | "dataverse"
    dynamics_provider: str = "none"

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_api_version: str = "2024-12-01-preview"

    # OpenAI (direct)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Local LLM (Ollama)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Azure Cosmos DB
    cosmos_endpoint: str = ""
    cosmos_key: str = ""
    cosmos_database: str = "core-discovery"

    # Local storage
    local_storage_path: str = "./data"
    local_db_path: str = "./data/core.db"

    # Project artifacts mount root. Per-project ``repo_path`` values that are
    # not absolute are resolved relative to this directory. Customer deploys
    # mount their ``./projects`` folder here so engagements can reference
    # subdirectories by name (e.g. ``repo_path: "allstate-claims"``).
    projects_root: str = "./data/projects"

    # When true, FastAPI startup will (re)create Cosmos containers. Default off so
    # production restarts don't pay the round-trip on every pod boot.
    cosmos_ensure_collections: bool = False

    # Azure Blob Storage
    azure_storage_account: str = ""
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "transcripts"

    # Azure Speech
    azure_speech_key: str = ""
    azure_speech_region: str = ""
    azure_speech_resource_id: str = ""

    # Azure Entra ID
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""

    # Dynamics 365 / Dataverse
    dynamics_url: str = ""

    # Bing Web Search v7
    bing_search_api_key: str = ""
    bing_search_endpoint: str = ""

    # Rate limiting
    rate_limit: str = "100/minute"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def validate_providers(self) -> list[str]:
        """Check required env vars are set for the selected providers. Returns warnings."""
        warnings: list[str] = []
        if self.llm_provider == "azure" and not self.azure_openai_endpoint:
            warnings.append("AZURE_OPENAI_ENDPOINT required when LLM_PROVIDER=azure")
        if self.llm_provider == "openai" and not self.openai_api_key:
            warnings.append("OPENAI_API_KEY required when LLM_PROVIDER=openai")
        if self.storage_provider in ("azure", "cosmos") and not self.cosmos_endpoint:
            warnings.append("COSMOS_ENDPOINT required when STORAGE_PROVIDER=azure")
        if self.auth_provider in ("azure", "entra"):
            if not self.azure_tenant_id:
                warnings.append("AZURE_TENANT_ID required when AUTH_PROVIDER=azure")
            if not self.azure_client_id:
                warnings.append("AZURE_CLIENT_ID required when AUTH_PROVIDER=azure")
        if self.speech_provider == "azure":
            if not self.azure_speech_region:
                warnings.append("AZURE_SPEECH_REGION required when SPEECH_PROVIDER=azure")
        if self.search_provider == "bing" and not self.bing_search_api_key:
            warnings.append("BING_SEARCH_API_KEY required when SEARCH_PROVIDER=bing")
        if self.graph_provider in ("msgraph", "azure"):
            if not (self.azure_tenant_id and self.azure_client_id):
                warnings.append(
                    "AZURE_TENANT_ID and AZURE_CLIENT_ID required when GRAPH_PROVIDER=msgraph "
                    "(AZURE_CLIENT_SECRET optional; falls back to DefaultAzureCredential)"
                )
        if self.dynamics_provider in ("dataverse", "dynamics"):
            if not self.dynamics_url:
                warnings.append("DYNAMICS_URL required when DYNAMICS_PROVIDER=dataverse")
        return warnings


settings = Settings()
