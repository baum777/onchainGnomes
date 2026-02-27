"""X (Twitter) API client with OAuth 1.0a."""

import asyncio
from typing import Any

from requests_oauthlib import OAuth1Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.config import get_settings
from src.observability.logger import get_logger
from src.observability.metrics import api_calls

logger = get_logger(__name__)

X_API_BASE = "https://api.twitter.com"
X_API_V2 = f"{X_API_BASE}/2"


class XClientError(Exception):
    """X API client error."""

    pass


class XRateLimitError(XClientError):
    """Rate limit exceeded."""

    pass


class XClient:
    """X API client with OAuth 1.0a authentication."""

    def __init__(
        self,
        api_key: str | None = None,
        api_secret: str | None = None,
        access_token: str | None = None,
        access_secret: str | None = None,
    ):
        settings = get_settings()
        self._api_key = api_key or settings.x_api_key
        self._api_secret = api_secret or settings.x_api_secret
        self._access_token = access_token or settings.x_access_token
        self._access_secret = access_secret or settings.x_access_secret
        self._session: OAuth1Session | None = None

    def _get_session(self) -> OAuth1Session:
        """Create or return OAuth session."""
        if self._session is None:
            self._session = OAuth1Session(
                client_key=self._api_key,
                client_secret=self._api_secret,
                resource_owner_key=self._access_token,
                resource_owner_secret=self._access_secret,
            )
            retry = Retry(total=3, backoff_factor=1)
            adapter = HTTPAdapter(max_retries=retry)
            self._session.mount("https://", adapter)
        return self._session

    async def _request(
        self,
        method: str,
        url: str,
        endpoint: str = "unknown",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Make authenticated request to X API."""
        session = self._get_session()
        loop = asyncio.get_event_loop()

        def _do_request():
            resp = session.request(method, url, **kwargs)
            api_calls.labels(
                service="x",
                endpoint=endpoint,
                status="success" if resp.ok else "error",
            ).inc()
            if resp.status_code == 429:
                raise XRateLimitError("X API rate limit exceeded")
            if not resp.ok:
                logger.error(
                    "x_api_error",
                    status=resp.status_code,
                    body=resp.text[:500],
                    endpoint=endpoint,
                )
                raise XClientError(f"X API error: {resp.status_code} - {resp.text}")
            return resp.json() if resp.content else {}

        return await loop.run_in_executor(None, _do_request)

    async def post_tweet(
        self,
        text: str,
        in_reply_to_id: str | None = None,
        media_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Post a new tweet or reply."""
        payload: dict[str, Any] = {"text": text}
        if in_reply_to_id:
            payload["reply"] = {"in_reply_to_tweet_id": in_reply_to_id}
        if media_ids:
            payload["media"] = {"media_ids": media_ids}

        return await self._request(
            "POST",
            f"{X_API_V2}/tweets",
            endpoint="post_tweet",
            json=payload,
        )

    async def get_mentions(self, since_id: str | None = None) -> dict[str, Any]:
        """Get mentions for the authenticated user."""
        params: dict[str, Any] = {
            "max_results": 100,
            "tweet.fields": "created_at,author_id,conversation_id,in_reply_to_user_id",
            "expansions": "author_id",
        }
        if since_id:
            params["since_id"] = since_id

        return await self._request(
            "GET",
            f"{X_API_V2}/users/me/mentions",
            endpoint="get_mentions",
            params=params,
        )

    async def get_tweet(self, tweet_id: str) -> dict[str, Any]:
        """Get a single tweet by ID."""
        params = {
            "tweet.fields": "created_at,author_id,conversation_id,text",
            "expansions": "author_id",
        }
        return await self._request(
            "GET",
            f"{X_API_V2}/tweets/{tweet_id}",
            endpoint="get_tweet",
            params=params,
        )

    async def upload_media(self, media_data: bytes, media_type: str) -> str:
        """Upload media and return media_id (uses v1.1 endpoint)."""
        session = self._get_session()
        loop = asyncio.get_event_loop()

        def _do_upload():
            resp = session.post(
                f"{X_API_BASE}/1.1/media/upload.json",
                files={"media": ("image.png", media_data, media_type)},
            )
            api_calls.labels(
                service="x",
                endpoint="upload_media",
                status="success" if resp.ok else "error",
            ).inc()
            if not resp.ok:
                raise XClientError(f"Media upload failed: {resp.text}")
            return resp.json()["media_id_string"]

        return await loop.run_in_executor(None, _do_upload)
