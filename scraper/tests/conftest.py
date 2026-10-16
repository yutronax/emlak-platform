# -*- coding: utf-8 -*-
"""Pytest ayarları: scraper/ modüllerini import yolunda tutar ve
`integration` işaretli testleri varsayılan olarak atlar.

Gerçek Supabase projesine karşı testleri çalıştırmak için:
    pytest --run-integration
veya
    RUN_INTEGRATION=1 pytest
"""

import os
import sys

import pytest

SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SCRAPER_DIR not in sys.path:
    sys.path.insert(0, SCRAPER_DIR)


def pytest_addoption(parser):
    parser.addoption(
        "--run-integration",
        action="store_true",
        default=False,
        help="Gerçek Supabase projesine karşı 'integration' testlerini çalıştır.",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: gerçek Supabase bağlantısı gerektirir (varsayılan olarak atlanır).",
    )


def pytest_collection_modifyitems(config, items):
    enabled = config.getoption("--run-integration") or os.environ.get("RUN_INTEGRATION") == "1"
    if enabled:
        return
    skip = pytest.mark.skip(
        reason="integration: --run-integration veya RUN_INTEGRATION=1 gerekli"
    )
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip)
