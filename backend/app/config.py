from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CORE Discovery API"
    debug: bool = False

    # Provider selection: "azure" | "local" | "openai"
    llm_provider: str = "local"
    storage_provider: str = "local"
    auth_provider: str = "none"
    speech_provider: str = "none"

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

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
