from __future__ import annotations

import ipaddress
import os
import socket
from functools import lru_cache
from typing import Iterable
from urllib.parse import urljoin, urlparse


def _split_env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "")
    if raw.strip():
        return [item.strip() for item in raw.split(",") if item.strip()]
    return default


ALLOWED_PDF_HOSTS = _split_env_list("PDF_ALLOWED_HOSTS", ["escribemeetings.com"])
PDF_REDIRECT_LIMIT = int(os.getenv("PDF_REDIRECT_LIMIT", "5"))


def _host_matches_allowed(host: str, allowed_hosts: Iterable[str]) -> bool:
    normalized_host = host.lower().rstrip(".")
    for allowed in allowed_hosts:
        allowed_host = allowed.lower().rstrip(".")
        if allowed_host.startswith("*."):
            allowed_host = allowed_host[2:]
        if normalized_host == allowed_host or normalized_host.endswith(f".{allowed_host}"):
            return True
    return False


def _is_public_ip_address(ip: ipaddress._BaseAddress) -> bool:
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


@lru_cache(maxsize=512)
def _resolve_host_ips(host: str) -> tuple[ipaddress._BaseAddress, ...]:
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host '{host}'") from exc

    ips: list[ipaddress._BaseAddress] = []
    for _, _, _, _, sockaddr in infos:
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            continue
        if ip not in ips:
            ips.append(ip)

    if not ips:
        raise ValueError(f"Host '{host}' did not resolve to an IP address")

    return tuple(ips)


def validate_pdf_url(url: str, allowed_hosts: Iterable[str] | None = None) -> str:
    allowed = tuple(allowed_hosts or ALLOWED_PDF_HOSTS)
    parsed = urlparse(url)

    if parsed.scheme.lower() != "https":
        raise ValueError("Only HTTPS PDF URLs are allowed")
    if parsed.username or parsed.password:
        raise ValueError("PDF URLs must not contain credentials")
    if not parsed.hostname:
        raise ValueError("PDF URL must include a hostname")
    if not _host_matches_allowed(parsed.hostname, allowed):
        raise ValueError(f"PDF host '{parsed.hostname}' is not allowed")

    for ip in _resolve_host_ips(parsed.hostname):
        if not _is_public_ip_address(ip):
            raise ValueError(f"PDF host '{parsed.hostname}' resolves to a non-public IP address")

    return url


def resolve_pdf_url(base_url: str, href: str, allowed_hosts: Iterable[str] | None = None) -> str:
    return validate_pdf_url(urljoin(f"{base_url.rstrip('/')}/", href), allowed_hosts=allowed_hosts)


def resolve_redirect_url(current_url: str, location: str, allowed_hosts: Iterable[str] | None = None) -> str:
    return validate_pdf_url(urljoin(current_url, location), allowed_hosts=allowed_hosts)
