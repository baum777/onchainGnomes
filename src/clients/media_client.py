"""Media handling - image generation and upload."""

from typing import Any

from src.observability.logger import get_logger

logger = get_logger(__name__)


class MediaClient:
    """Handles image generation and media uploads.

    Stub implementation - integrates with xAI image API and X media upload.
    """

    async def generate_image(self, prompt: str) -> bytes:
        """Generate image from prompt via xAI API.

        Returns raw image bytes.
        """
        logger.info("media_generate_image", prompt=prompt[:100])
        # TODO: Integrate with xAI image generation API when available
        raise NotImplementedError("Image generation not yet implemented")

    async def generate_and_upload(
        self,
        prompt: str,
        x_client: Any,
    ) -> str:
        """Generate image and upload to X, return media_id."""
        image_data = await self.generate_image(prompt)
        return await x_client.upload_media(image_data, "image/png")
