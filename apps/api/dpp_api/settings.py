"""Centralised settings, loaded from environment per twelve-factor.

All env keys are prefixed `DPP_` (or are well-known like POSTGRES_*).
Configuration is immutable after process start; tests override via dependency
injection, never by mutating the singleton.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SigningProvider = Literal["local_file", "env", "aws_kms"]

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Process-wide settings."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Environment selector ────────────────────────────────────────────────
    dpp_env: Environment = Field(default="development")

    # ── Default tenant for development convenience ──────────────────────────
    dpp_default_tenant_id: int = Field(default=1)
    dpp_default_tenant_slug: str = Field(default="ega")

    # ── Postgres ────────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://dpp_app:dpp_local_dev_only@localhost:5432/dpp"
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg://dpp_app:dpp_local_dev_only@localhost:5432/dpp"
    )
    db_pool_size: int = Field(default=10)
    db_max_overflow: int = Field(default=20)
    db_pool_pre_ping: bool = Field(default=True)
    db_echo: bool = Field(default=False)

    # ── Redis ───────────────────────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379/0")

    # ── Issuer identity (Ed25519 + did:web) ─────────────────────────────────
    dpp_issuer_did: str = Field(default="did:web:passport.hzlindia.com:BPNLHZL0000001QX")
    dpp_signing_provider: SigningProvider = Field(default="local_file")

    # local_file provider
    dpp_issuer_key_path: Path = Field(default=Path("./infra/dev-keys/issuer-ed25519.pem"))
    dpp_issuer_public_key_path: Path = Field(
        default=Path("./infra/dev-keys/issuer-ed25519.pub.pem")
    )

    # env provider (for k8s secret mount): base64url-encoded raw 32-byte private key.
    dpp_issuer_key_b64: SecretStr | None = Field(default=None)
    dpp_issuer_public_key_b64: SecretStr | None = Field(default=None)

    # aws_kms provider: KMS key ID/ARN for an asymmetric Ed25519 (or ECC_NIST_P256) key.
    dpp_kms_key_id: str | None = Field(default=None)
    dpp_kms_region: str | None = Field(default=None)

    # ── JWT auth ────────────────────────────────────────────────────────────
    dpp_jwt_issuer: str = Field(default="https://idp.dpp.ega.local")
    dpp_jwt_audience: str = Field(default="dpp-api")
    dpp_jwt_algorithms: tuple[str, ...] = Field(default=("RS256", "ES256"))
    dpp_jwt_jwks_url: str | None = Field(default=None)
    # HS256 dev secret. Honoured ONLY when dpp_env != "production". The
    # validator below raises at boot if both env=production and dev secret
    # are set, preventing accidental promotion of a dev secret.
    dpp_jwt_dev_secret: SecretStr | None = Field(default=None)

    # ── URLs ────────────────────────────────────────────────────────────────
    dpp_resolver_base_url: str = Field(default="http://localhost:3000")
    dpp_api_base_url: str = Field(default="http://localhost:8000")

    # ── CORS ────────────────────────────────────────────────────────────────
    dpp_cors_origins: str = Field(default="http://localhost:3000,http://localhost:3001")

    # ── Logging ─────────────────────────────────────────────────────────────
    dpp_log_level: str = Field(default="INFO")
    dpp_log_format: Literal["json", "console"] = Field(default="json")

    # ── Feature flags ───────────────────────────────────────────────────────
    dpp_feature_dlt_anchor: bool = Field(default=False)
    dpp_feature_workshop_mode: bool = Field(default=True)
    dpp_feature_cbam_export: bool = Field(default=False)

    # ── Service-to-service authentication ───────────────────────────────────
    dpp_internal_api_key: SecretStr | None = Field(default=None)

    # ── Rate limiting ───────────────────────────────────────────────────────
    dpp_rate_limit_enabled: bool = Field(default=True)
    # Per-tenant token bucket; capacity=burst, refill rate per minute.
    dpp_rate_limit_burst: int = Field(default=600)
    dpp_rate_limit_per_minute: int = Field(default=600)
    # Anonymous (public viewer) bucket — keyed on client IP.
    dpp_rate_limit_anon_burst: int = Field(default=120)
    dpp_rate_limit_anon_per_minute: int = Field(default=120)

    # ── Observability ───────────────────────────────────────────────────────
    dpp_otel_exporter_otlp_endpoint: str | None = Field(default=None)
    dpp_otel_service_name: str = Field(default="dpp-api")
    dpp_sentry_dsn: SecretStr | None = Field(default=None)
    dpp_sentry_traces_sample_rate: float = Field(default=0.05)
    dpp_sentry_environment: str | None = Field(default=None)

    @field_validator("dpp_cors_origins")
    @classmethod
    def _validate_cors(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.dpp_cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.dpp_env == "production"

    @model_validator(mode="after")
    def _enforce_production_security(self) -> Settings:
        """Hard-fail boot if production lacks a real auth/signing config.

        These checks exist to keep dev shortcuts from leaking into prod:
          - JWT must be JWKS-verified; dev HS256 secret MUST be empty.
          - Signing provider must NOT be local_file with its dev-key default.
        """
        if not self.is_production:
            return self
        errors: list[str] = []
        if not self.dpp_jwt_jwks_url:
            errors.append("dpp_jwt_jwks_url is required in production")
        if self.dpp_jwt_dev_secret is not None:
            errors.append("dpp_jwt_dev_secret must be unset in production")
        if self.dpp_signing_provider == "local_file" and "dev-keys" in str(
            self.dpp_issuer_key_path
        ):
            errors.append(
                "dpp_signing_provider=local_file with dev-keys is forbidden in "
                "production; use 'env' or 'aws_kms', or point local_file at a "
                "non-default secret-mounted path"
            )
        if self.dpp_signing_provider == "aws_kms" and not self.dpp_kms_key_id:
            errors.append("dpp_kms_key_id is required when dpp_signing_provider=aws_kms")
        if errors:
            raise ValueError("production security misconfiguration:\n  - " + "\n  - ".join(errors))
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return process-wide settings singleton."""
    return Settings()
