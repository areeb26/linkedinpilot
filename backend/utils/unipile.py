"""
Unipile API client for the LinkedPilot backend worker.

Wraps all Unipile REST endpoints needed by the action queue dispatcher.
Reads credentials from environment variables (UNIPILE_DSN, UNIPILE_API_KEY).
"""
import os
from typing import Optional

import httpx
from dotenv import load_dotenv

from utils.logger import logger

load_dotenv()


class UnipileClient:
    """Async HTTP client for the Unipile REST API."""

    def __init__(self):
        dsn = os.getenv("UNIPILE_DSN")
        api_key = os.getenv("UNIPILE_API_KEY")

        if not dsn:
            raise RuntimeError(
                "[Unipile] UNIPILE_DSN is not set. "
                "Add it to your .env file (see .env.example)."
            )
        if not api_key:
            raise RuntimeError(
                "[Unipile] UNIPILE_API_KEY is not set. "
                "Add it to your .env file (see .env.example)."
            )

        self.base_url = f"https://{dsn}/api/v1"
        self._headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    # -------------------------------------------------------------------------
    # Core HTTP dispatcher
    # -------------------------------------------------------------------------

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """
        Central HTTP dispatcher.

        Raises httpx.HTTPStatusError on non-2xx responses so callers can map
        status codes to the appropriate exception type.
        """
        url = f"{self.base_url}{path}"
        # Remove Content-Type for multipart requests (httpx sets it automatically)
        headers = dict(self._headers)
        if "files" in kwargs or "data" in kwargs:
            headers.pop("Content-Type", None)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)

        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                f"[Unipile] {method} {path} → HTTP {exc.response.status_code}: "
                f"{exc.response.text[:500]}"
            )
            raise

        return resp.json()

    # -------------------------------------------------------------------------
    # Account management
    # -------------------------------------------------------------------------

    async def list_accounts(self) -> list:
        """GET /api/v1/accounts — list all connected accounts."""
        data = await self._request("GET", "/accounts")
        return data.get("items", [])

    async def resync_account(self, unipile_account_id: str) -> dict:
        """POST /api/v1/accounts/{id}/resync — reconnect a disconnected account."""
        return await self._request("POST", f"/accounts/{unipile_account_id}/resync")

    async def delete_account(self, unipile_account_id: str) -> dict:
        """DELETE /api/v1/accounts/{id} — remove an account from Unipile."""
        return await self._request("DELETE", f"/accounts/{unipile_account_id}")

    # -------------------------------------------------------------------------
    # Profiles
    # -------------------------------------------------------------------------

    async def get_profile(self, account_id: str, identifier: str) -> dict:
        """
        GET /api/v1/users/{identifier}?account_id=...
        Retrieve a LinkedIn user profile by public identifier or provider ID.
        """
        return await self._request(
            "GET",
            f"/users/{identifier}",
            params={"account_id": account_id},
        )

    async def get_own_profile(self, account_id: str) -> dict:
        """GET /api/v1/users/me?account_id=... — retrieve the authenticated user's profile."""
        return await self._request("GET", "/users/me", params={"account_id": account_id})

    async def get_company_profile(self, account_id: str, identifier: str) -> dict:
        """GET /api/v1/users/company/{identifier}?account_id=..."""
        return await self._request(
            "GET",
            f"/users/company/{identifier}",
            params={"account_id": account_id},
        )

    async def get_relations(self, account_id: str, cursor: Optional[str] = None) -> dict:
        """GET /api/v1/users/relations?account_id=... — list connections."""
        params = {"account_id": account_id}
        if cursor:
            params["cursor"] = cursor
        return await self._request("GET", "/users/relations", params=params)

    # -------------------------------------------------------------------------
    # Messaging
    # -------------------------------------------------------------------------

    async def list_chats(self, account_id: str, limit: int = 50) -> dict:
        """GET /api/v1/chats?account_id=..."""
        return await self._request(
            "GET",
            "/chats",
            params={"account_id": account_id, "limit": limit},
        )

    async def get_chat(self, chat_id: str) -> dict:
        """GET /api/v1/chats/{id}"""
        return await self._request("GET", f"/chats/{chat_id}")

    async def list_messages(self, chat_id: str) -> dict:
        """GET /api/v1/chats/{id}/messages"""
        return await self._request("GET", f"/chats/{chat_id}/messages")

    async def list_attendees(self, chat_id: str) -> dict:
        """GET /api/v1/chats/{id}/attendees"""
        return await self._request("GET", f"/chats/{chat_id}/attendees")

    async def get_or_create_chat(self, account_id: str, attendee_id: str) -> str:
        """
        Silently resolve a chat ID for the given attendee.

        1. Search existing chats for one that contains the attendee.
        2. If not found, create a new chat (POST /api/v1/chats).
        Returns the chat_id string.
        """
        # Search existing chats
        try:
            chats_data = await self.list_chats(account_id, limit=100)
            for chat in chats_data.get("items", []):
                attendees = chat.get("attendees", [])
                for att in attendees:
                    if att.get("provider_id") == attendee_id or att.get("id") == attendee_id:
                        return chat["id"]
        except httpx.HTTPStatusError:
            pass  # Fall through to create

        # Create new chat
        result = await self._request(
            "POST",
            "/chats",
            json={"account_id": account_id, "attendees_ids": [attendee_id]},
        )
        return result["id"]

    async def send_message(self, chat_id: str, text: str, account_id: str) -> dict:
        """POST /api/v1/chats/{id}/messages"""
        return await self._request(
            "POST",
            f"/chats/{chat_id}/messages",
            json={"text": text, "account_id": account_id},
        )

    async def start_new_chat(self, account_id: str, attendee_id: str, text: str) -> dict:
        """POST /api/v1/chats — start a new DM conversation."""
        return await self._request(
            "POST",
            "/chats",
            json={
                "account_id": account_id,
                "attendees_ids": [attendee_id],
                "text": text,
            },
        )

    async def send_inmail(
        self,
        account_id: str,
        attendee_id: str,
        text: str,
        api: str = "classic",
    ) -> dict:
        """POST /api/v1/chats with inmail:true — send an InMail."""
        return await self._request(
            "POST",
            "/chats",
            json={
                "account_id": account_id,
                "attendees_ids": [attendee_id],
                "text": text,
                "options": {"linkedin": {"api": api, "inmail": True}},
            },
        )

    # -------------------------------------------------------------------------
    # Invitations
    # -------------------------------------------------------------------------

    async def send_invitation(
        self,
        account_id: str,
        provider_id: str,
        message: Optional[str] = None,
    ) -> dict:
        """POST /api/v1/users/invite — send a LinkedIn connection request."""
        body: dict = {"account_id": account_id, "provider_id": provider_id}
        if message:
            body["message"] = message
        return await self._request("POST", "/users/invite", json=body)

    async def list_sent_invitations(self, account_id: str) -> dict:
        """GET /api/v1/users/invitations/sent?account_id=..."""
        return await self._request(
            "GET",
            "/users/invitations/sent",
            params={"account_id": account_id},
        )

    async def cancel_invitation(self, account_id: str, invitation_id: str) -> dict:
        """DELETE /api/v1/users/invitations/{id}"""
        return await self._request(
            "DELETE",
            f"/users/invitations/{invitation_id}",
            params={"account_id": account_id},
        )

    async def list_received_invitations(self, account_id: str) -> dict:
        """GET /api/v1/users/invitations/received?account_id=..."""
        return await self._request(
            "GET",
            "/users/invitations/received",
            params={"account_id": account_id},
        )

    async def handle_invitation(
        self,
        account_id: str,
        invitation_id: str,
        action: str,  # "accept" or "decline"
    ) -> dict:
        """POST /api/v1/users/invitations/handle — accept or decline a received invitation."""
        return await self._request(
            "POST",
            "/users/invitations/handle",
            json={
                "account_id": account_id,
                "invitation_id": invitation_id,
                "action": action,
            },
        )

    # -------------------------------------------------------------------------
    # Search
    # -------------------------------------------------------------------------

    async def search(self, account_id: str, params: dict) -> dict:
        """
        POST /api/v1/linkedin/search?account_id=...
        Supports Classic, Sales Navigator, and Recruiter tiers.
        params should include: api_type, category, keywords, filters, cursor, etc.
        """
        return await self._request(
            "POST",
            "/linkedin/search",
            params={"account_id": account_id},
            json=params,
        )

    async def get_search_parameters(
        self,
        account_id: str,
        param_type: str,
        keywords: Optional[str] = None,
    ) -> dict:
        """GET /api/v1/linkedin/search/parameters — fetch filter options."""
        query_params = {"account_id": account_id, "type": param_type}
        if keywords:
            query_params["keywords"] = keywords
        return await self._request(
            "GET",
            "/linkedin/search/parameters",
            params=query_params,
        )

    # -------------------------------------------------------------------------
    # Posts & Engagement
    # -------------------------------------------------------------------------

    async def list_user_posts(self, account_id: str, identifier: str) -> dict:
        """GET /api/v1/users/{identifier}/posts?account_id=..."""
        return await self._request(
            "GET",
            f"/users/{identifier}/posts",
            params={"account_id": account_id},
        )

    async def get_post(self, account_id: str, post_id: str) -> dict:
        """GET /api/v1/posts/{id}?account_id=..."""
        return await self._request(
            "GET",
            f"/posts/{post_id}",
            params={"account_id": account_id},
        )

    async def create_post(self, account_id: str, text: str) -> dict:
        """POST /api/v1/posts — create a new LinkedIn post."""
        return await self._request(
            "POST",
            "/posts",
            json={"account_id": account_id, "text": text},
        )

    async def comment_on_post(self, account_id: str, post_id: str, text: str) -> dict:
        """POST /api/v1/posts/{id}/comments"""
        return await self._request(
            "POST",
            f"/posts/{post_id}/comments",
            json={"account_id": account_id, "text": text},
        )

    async def list_post_comments(self, account_id: str, post_id: str) -> dict:
        """GET /api/v1/posts/{id}/comments?account_id=..."""
        return await self._request(
            "GET",
            f"/posts/{post_id}/comments",
            params={"account_id": account_id},
        )

    async def react_to_post(
        self,
        account_id: str,
        post_id: str,
        reaction_type: str = "LIKE",
    ) -> dict:
        """POST /api/v1/posts/{id}/reactions"""
        return await self._request(
            "POST",
            f"/posts/{post_id}/reactions",
            json={"account_id": account_id, "reaction_type": reaction_type},
        )
