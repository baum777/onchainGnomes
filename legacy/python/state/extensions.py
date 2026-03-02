"""
State Manager Extensions für Command DSL

Erweitert StateManager mit:
- User Profiles für Badge System
- Remix Chain Tracking
- Command History
"""

import json
import uuid
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from .manager import StateManager


@dataclass
class UserStats:
    """Statistiken für einen Benutzer."""
    user_id: str
    interactions: int = 0
    level: int = 1
    badges: List[str] = None
    first_interaction: Optional[int] = None
    last_interaction: Optional[int] = None

    def __post_init__(self):
        if self.badges is None:
            self.badges = []


@dataclass
class RemixChainEntry:
    """Ein Entry in einer Remix Chain."""
    chain_id: str
    entry_number: int
    tweet_id: str
    user_id: str
    flavor: Optional[str] = None
    energy: Optional[int] = None
    matrix_meta: Optional[Dict[str, Any]] = None


class StateExtensions:
    """
    Erweiterungen für StateManager.

    Fügt Methoden hinzu für:
    - User Profile Management
    - Remix Chain Tracking
    - Command History Recording
    """

    def __init__(self, state_manager: StateManager):
        """
        Initialisiert Extensions.

        Args:
            state_manager: Der zu erweiternde StateManager
        """
        self._state = state_manager

    async def get_user_stats(self, user_id: str) -> UserStats:
        """
        Holt User-Stats.

        Args:
            user_id: ID des Benutzers

        Returns:
            UserStats mit allen Statistiken
        """
        async with self._state._get_connection() as db:
            row = await db.fetchone(
                "SELECT * FROM user_profiles WHERE user_id = ?",
                (user_id,)
            )

        if not row:
            return UserStats(user_id=user_id)

        return UserStats(
            user_id=row["user_id"],
            interactions=row["interaction_count"],
            level=row["level"],
            badges=json.loads(row["badges"]) if row["badges"] else [],
            first_interaction=row["first_interaction"],
            last_interaction=row["last_interaction"],
        )

    async def record_interaction(self, user_id: str, handle: Optional[str] = None) -> None:
        """
        Zeichnet eine Benutzer-Interaktion auf.

        Args:
            user_id: ID des Benutzers
            handle: Optional - X-Handle
        """
        now = self._state._now()

        async with self._state._get_connection() as db:
            # Upsert des User Profiles
            await db.execute(
                """
                INSERT INTO user_profiles (user_id, handle, first_interaction, last_interaction, interaction_count)
                VALUES (?, ?, ?, ?, 1)
                ON CONFLICT(user_id) DO UPDATE SET
                    handle = COALESCE(EXCLUDED.handle, user_profiles.handle),
                    last_interaction = EXCLUDED.last_interaction,
                    interaction_count = user_profiles.interaction_count + 1
                """,
                (user_id, handle, now, now)
            )

    async def award_badge(self, user_id: str, badge: str) -> bool:
        """
        Verleiht einem Benutzer ein Badge.

        Args:
            user_id: ID des Benutzers
            badge: Badge-Name

        Returns:
            True wenn neu verliehen, False wenn bereits vorhanden
        """
        stats = await self.get_user_stats(user_id)

        if badge in stats.badges:
            return False

        badges = stats.badges + [badge]

        async with self._state._get_connection() as db:
            await db.execute(
                "UPDATE user_profiles SET badges = ? WHERE user_id = ?",
                (json.dumps(badges), user_id)
            )

        return True

    async def record_command(
        self,
        user_id: str,
        command_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Zeichnet einen Command in der Historie auf.

        Args:
            user_id: ID des Benutzers
            command_type: Typ des Commands
            metadata: Zusätzliche Metadaten

        Returns:
            Command ID
        """
        command_id = str(uuid.uuid4())[:8]
        meta = metadata or {}

        async with self._state._get_connection() as db:
            await db.execute(
                """
                INSERT INTO command_history
                (command_id, user_id, command_type, command_name, source_tweet_id,
                 conversation_id, args, action_type, template_key, energy,
                 flavor, prompt_text, preset_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    command_id,
                    user_id,
                    command_type,
                    meta.get("command_name"),
                    meta.get("source_tweet_id"),
                    meta.get("conversation_id"),
                    json.dumps(meta.get("args", {})),
                    meta.get("action_type"),
                    meta.get("action_plan", {}).get("template_key"),
                    meta.get("action_plan", {}).get("energy"),
                    meta.get("action_plan", {}).get("flavor"),
                    meta.get("prompt_text"),
                    meta.get("preset_key"),
                )
            )

        return command_id

    async def update_command_result(
        self,
        command_id: str,
        status: str,
        content_preview: Optional[str] = None,
        error_message: Optional[str] = None,
        matrix_meta: Optional[Dict[str, Any]] = None,
        processing_time_ms: Optional[int] = None
    ) -> None:
        """
        Aktualisiert das Ergebnis eines Commands.

        Args:
            command_id: ID des Commands
            status: Ergebnis-Status (success, error, pending)
            content_preview: Vorschau des generierten Inhalts
            error_message: Fehlermeldung bei Fehler
            matrix_meta: Matrix Payload Metadaten
            processing_time_ms: Verarbeitungszeit in Millisekunden
        """
        now = self._state._now()

        async with self._state._get_connection() as db:
            await db.execute(
                """
                UPDATE command_history
                SET result_status = ?,
                    result_content_preview = ?,
                    error_message = ?,
                    matrix_meta = ?,
                    processing_time_ms = ?,
                    completed_at = ?
                WHERE command_id = ?
                """,
                (
                    status,
                    content_preview,
                    error_message,
                    json.dumps(matrix_meta) if matrix_meta else None,
                    processing_time_ms,
                    now,
                    command_id,
                )
            )

    async def create_remix_chain(
        self,
        original_tweet_id: str,
        original_user_id: str,
        original_content: str,
        root_command_id: Optional[str] = None
    ) -> str:
        """
        Erstellt eine neue Remix Chain.

        Args:
            original_tweet_id: ID des Original-Tweets
            original_user_id: ID des Original-Autors
            original_content: Inhalt des Originals
            root_command_id: ID des initierenden Commands

        Returns:
            Chain ID
        """
        chain_id = str(uuid.uuid4())[:8]

        async with self._state._get_connection() as db:
            await db.execute(
                """
                INSERT INTO remix_chain
                (chain_id, original_tweet_id, original_user_id, original_content, root_command_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (chain_id, original_tweet_id, original_user_id, original_content, root_command_id)
            )

        return chain_id

    async def add_remix_to_chain(
        self,
        chain_id: str,
        tweet_id: str,
        user_id: str,
        flavor: Optional[str] = None,
        energy: Optional[int] = None,
        matrix_meta: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Fügt einen Remix zu einer Chain hinzu.

        Args:
            chain_id: ID der Chain
            tweet_id: ID des Remix-Tweets
            user_id: ID des Remix-Autors
            flavor: Verwendeter Flavor
            energy: Verwendete Energy
            matrix_meta: Matrix Payload

        Returns:
            Entry Number in der Chain
        """
        async with self._state._get_connection() as db:
            # Aktuelle Länge der Chain ermitteln
            row = await db.fetchone(
                "SELECT MAX(entry_number) as max_num FROM remix_entries WHERE chain_id = ?",
                (chain_id,)
            )
            entry_number = (row["max_num"] or 0) + 1

            # Entry hinzufügen
            await db.execute(
                """
                INSERT INTO remix_entries
                (chain_id, entry_number, tweet_id, user_id, flavor, energy, matrix_meta)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chain_id,
                    entry_number,
                    tweet_id,
                    user_id,
                    flavor,
                    energy,
                    json.dumps(matrix_meta) if matrix_meta else None,
                )
            )

            # Chain aktualisieren
            now = self._state._now()
            await db.execute(
                """
                UPDATE remix_chain
                SET chain_depth = ?, last_remix_at = ?
                WHERE chain_id = ?
                """,
                (entry_number, now, chain_id)
            )

        return entry_number

    async def get_original_for_remix(self, tweet_id: str) -> Optional[Dict[str, Any]]:
        """
        Holt den Original-Content für einen Remix.

        Args:
            tweet_id: ID des Tweets (kann Original oder Remix sein)

        Returns:
            Dictionary mit Original-Content oder None
        """
        async with self._state._get_connection() as db:
            # Zuerst prüfen ob es eine Chain gibt
            row = await db.fetchone(
                """
                SELECT rc.* FROM remix_chain rc
                JOIN remix_entries re ON rc.chain_id = re.chain_id
                WHERE re.tweet_id = ?
                LIMIT 1
                """,
                (tweet_id,)
            )

            if row:
                return {
                    "chain_id": row["chain_id"],
                    "original_tweet_id": row["original_tweet_id"],
                    "original_user_id": row["original_user_id"],
                    "original_content": row["original_content"],
                }

            # Oder prüfen ob der Tweet selbst ein Original ist
            row = await db.fetchone(
                "SELECT * FROM remix_chain WHERE original_tweet_id = ?",
                (tweet_id,)
            )

            if row:
                return {
                    "chain_id": row["chain_id"],
                    "original_tweet_id": row["original_tweet_id"],
                    "original_user_id": row["original_user_id"],
                    "original_content": row["original_content"],
                }

        return None

    async def get_remix_chain(self, chain_id: str) -> List[RemixChainEntry]:
        """
        Holt alle Entries einer Remix Chain.

        Args:
            chain_id: ID der Chain

        Returns:
            Liste der Chain Entries
        """
        async with self._state._get_connection() as db:
            rows = await db.fetchall(
                """
                SELECT * FROM remix_entries
                WHERE chain_id = ?
                ORDER BY entry_number
                """,
                (chain_id,)
            )

        return [
            RemixChainEntry(
                chain_id=row["chain_id"],
                entry_number=row["entry_number"],
                tweet_id=row["tweet_id"],
                user_id=row["user_id"],
                flavor=row["flavor"],
                energy=row["energy"],
                matrix_meta=json.loads(row["matrix_meta"]) if row["matrix_meta"] else None,
            )
            for row in rows
        ]


# Monkey-Patch für StateManager
# Diese Methoden werden dynamisch zum StateManager hinzugefügt

async def _record_command_wrapper(
    self: StateManager,
    user_id: str,
    command_type: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Wrapper für record_command."""
    extensions = StateExtensions(self)
    return await extensions.record_command(user_id, command_type, metadata)


async def _get_user_stats_wrapper(self: StateManager, user_id: str) -> UserStats:
    """Wrapper für get_user_stats."""
    extensions = StateExtensions(self)
    return await extensions.get_user_stats(user_id)


async def _get_original_for_remix_wrapper(
    self: StateManager,
    tweet_id: str
) -> Optional[Dict[str, Any]]:
    """Wrapper für get_original_for_remix."""
    extensions = StateExtensions(self)
    return await extensions.get_original_for_remix(tweet_id)


# Extensions zum StateManager hinzufügen
StateManager.record_command = _record_command_wrapper
StateManager.get_user_stats = _get_user_stats_wrapper
StateManager.get_original_for_remix = _get_original_for_remix_wrapper
