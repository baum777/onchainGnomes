"""xAI (Grok) API client with retry logic."""

import asyncio
from typing import Any

import httpx
from src.config import get_settings
from src.observability.logger import get_logger
from src.observability.metrics import api_calls

logger = get_logger(__name__)

XAI_API_BASE = "https://api.x.ai/v1"


class XAIClientError(Exception):
    """xAI API client error."""

    pass


class XAIRateLimitError(XAIClientError):
    """xAI rate limit exceeded."""

    pass


class XAIClient:
    """xAI API client for Grok chat completions."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ):
        settings = get_settings()
        self._api_key = api_key or settings.xai_api_key
        self._model = model or settings.xai_model
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=XAI_API_BASE,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        endpoint: str = "unknown",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Make request with basic error handling."""
        client = await self._get_client()
        resp = await client.request(method, path, **kwargs)

        api_calls.labels(
            service="xai",
            endpoint=endpoint,
            status="success" if resp.is_success else "error",
        ).inc()

        if resp.status_code == 429:
            raise XAIRateLimitError("xAI API rate limit exceeded")

        if not resp.is_success:
            logger.error(
                "xai_api_error",
                status=resp.status_code,
                body=resp.text[:500],
                endpoint=endpoint,
            )
            raise XAIClientError(f"xAI error: {resp.status_code} - {resp.text}")

        return resp.json() if resp.content else {}

    def _chat_request_with_retry(
        self,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Sync retry wrapper - we'll call this from async."""
        # This would be called via run_in_executor if we needed sync retry
        # For now we use async retry in complete()
        raise NotImplementedError("Use complete() instead")

    async def complete(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 280,
        temperature: float = 0.7,
    ) -> str:
        """Get chat completion from Grok with retry logic."""
        payload = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        max_attempts = 3

        for attempt in range(max_attempts):
            try:
                result = await self._request(
                    "POST",
                    "/chat/completions",
                    endpoint="chat_completions",
                    json=payload,
                )
                choices = result.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if content:
                        return content
                return ""
            except XAIRateLimitError:
                if attempt < max_attempts - 1:
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(
                        "xai_rate_limit_retry",
                        attempt=attempt + 1,
                        wait_seconds=wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise
            except (httpx.HTTPError, httpx.ConnectError) as e:
                if attempt < max_attempts - 1:
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(
                        "xai_request_retry",
                        error=str(e),
                        attempt=attempt + 1,
                        wait_seconds=wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise XAIClientError(str(e)) from e

        return ""

    async def complete_with_prompt(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 280,
        temperature: float = 0.7,
    ) -> str:
        """Convenience method for system + user message."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        return await self.complete(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
