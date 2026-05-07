"""Vedanta · Hindustan Zinc Limited (HZL) DPP Platform — backend.

Layered per SDD §3:
    Layer 1  source capture (sources/)
    Layer 2  canonical schema + event store (db/, services/cast_events.py)
    Layer 3  identity, signing, trust (services/signer.py)
    Layer 4  backend services + persistence (services/, db/)
    Layer 5  resolver + presentation API (routers/)
    Layer 6  integrations (integrations/)
"""

__version__ = "0.1.0"
