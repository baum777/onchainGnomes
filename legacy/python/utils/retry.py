"""Retry utilities with exponential backoff."""

from typing import TypeVar, Callable, Any

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

T = TypeVar("T")


def with_retry(
    max_attempts: int = 3,
    min_wait: float = 4,
    max_wait: float = 60,
    retry_exceptions: tuple[type[Exception], ...] = (Exception,),
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator for retrying with exponential backoff."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        return retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
            retry=retry_if_exception_type(retry_exceptions),
            reraise=True,
        )(func)

    return decorator
