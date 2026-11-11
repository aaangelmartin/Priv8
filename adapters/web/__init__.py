"""Adaptador web (Camino 2): ERP Alba Core y bandeja de correo con Playwright."""

from .adapter import APPS, WebAdapter, headless_enabled, profile_dir

__all__ = ["APPS", "WebAdapter", "headless_enabled", "profile_dir"]
