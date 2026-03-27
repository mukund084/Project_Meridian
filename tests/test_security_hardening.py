from __future__ import annotations

import importlib
import ipaddress
import sys

import pytest
from fastapi.testclient import TestClient

import network_security


def _import_fresh(module_name: str):
    sys.modules.pop(module_name, None)
    return importlib.import_module(module_name)


def test_validate_pdf_url_accepts_allowed_public_hosts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        network_security,
        "_resolve_host_ips",
        lambda host: (ipaddress.ip_address("93.184.216.34"),),
    )

    url = "https://pub-markham.escribemeetings.com/FileStream.ashx?DocumentId=123"
    assert network_security.validate_pdf_url(url, allowed_hosts=["escribemeetings.com"]) == url


def test_validate_pdf_url_rejects_non_https(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        network_security,
        "_resolve_host_ips",
        lambda host: (ipaddress.ip_address("93.184.216.34"),),
    )

    with pytest.raises(ValueError, match="Only HTTPS"):
        network_security.validate_pdf_url(
            "http://pub-markham.escribemeetings.com/FileStream.ashx?DocumentId=123",
            allowed_hosts=["escribemeetings.com"],
        )


def test_resolve_pdf_url_rejects_external_protocol_relative_links(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        network_security,
        "_resolve_host_ips",
        lambda host: (ipaddress.ip_address("93.184.216.34"),),
    )

    with pytest.raises(ValueError, match="not allowed"):
        network_security.resolve_pdf_url(
            "https://pub-markham.escribemeetings.com",
            "//evil.example/FileStream.ashx?DocumentId=123",
            allowed_hosts=["escribemeetings.com"],
        )


def test_validate_pdf_url_rejects_private_ip_targets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        network_security,
        "_resolve_host_ips",
        lambda host: (ipaddress.ip_address("127.0.0.1"),),
    )

    with pytest.raises(ValueError, match="non-public IP"):
        network_security.validate_pdf_url(
            "https://pub-markham.escribemeetings.com/FileStream.ashx?DocumentId=123",
            allowed_hosts=["escribemeetings.com"],
        )


def test_api_requires_allowed_hosts_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOWED_HOSTS", raising=False)
    monkeypatch.delenv("ENABLE_API_DOCS", raising=False)

    with pytest.raises(RuntimeError, match="ALLOWED_HOSTS"):
        _import_fresh("api")


def test_api_disables_docs_by_default_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ALLOWED_HOSTS", "api.example.com")
    monkeypatch.delenv("ENABLE_API_DOCS", raising=False)

    api = _import_fresh("api")
    assert api.app.docs_url is None
    assert api.app.redoc_url is None
    assert api.app.openapi_url is None


def test_api_uses_safe_local_defaults_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOWED_HOSTS", raising=False)
    monkeypatch.delenv("ENABLE_API_DOCS", raising=False)

    api = _import_fresh("api")
    assert "localhost" in api.ALLOWED_HOSTS
    assert "testserver" in api.ALLOWED_HOSTS
    assert api.app.docs_url == "/docs"


def test_api_rate_limits_repeated_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("ALLOWED_HOSTS", raising=False)
    monkeypatch.setenv("RATE_LIMIT_REQUESTS", "2")
    monkeypatch.setenv("RATE_LIMIT_WINDOW_SECONDS", "60")

    api = _import_fresh("api")
    client = TestClient(api.app)

    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 200
    response = client.get("/health")

    assert response.status_code == 429
    assert response.json()["detail"] == "Rate limit exceeded"
