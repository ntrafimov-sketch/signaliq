"""
AppMagic MCP Server

Exposes AppMagic API (https://api.appmagic.rocks/v1) as MCP tools.

Store codes:
  1 = Google Play
  2 = iPhone App Store
  3 = iPad App Store
  5 = All stores (for audience metrics)
"""

import base64
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

from mcp.server.fastmcp import FastMCP

BASE_URL = "https://api.appmagic.rocks/v1"
LOGIN = os.environ.get("APPMAGIC_LOGIN", "Adapty Tech")
PASSWORD = os.environ.get("APPMAGIC_PASSWORD", "LyjsH27MJrqxyhLz")

mcp = FastMCP("AppMagic")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _auth_header() -> str:
    token = base64.b64encode(f"{LOGIN}:{PASSWORD}".encode()).decode()
    return f"Basic {token}"


def _request(req: urllib.request.Request, retries: int = 3) -> Any:
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 60))
                time.sleep(wait)
                continue
            body = e.read().decode(errors="replace")
            raise RuntimeError(f"HTTP {e.code}: {body[:500]}")
        except Exception as ex:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
    return None


def _headers() -> dict:
    return {"Authorization": _auth_header(), "Accept": "application/json"}


def api_get(path: str, params: dict | None = None) -> Any:
    url = f"{BASE_URL}{path}" if not path.startswith("http") else path
    if params:
        url += "?" + urllib.parse.urlencode(
            {k: v for k, v in params.items() if v is not None}, doseq=True
        )
    req = urllib.request.Request(url, headers=_headers())
    return _request(req)


def api_post(path: str, body: dict) -> Any:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={**_headers(), "Content-Type": "application/json"},
        method="POST",
    )
    return _request(req)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def search_apps(
    store: int,
    revenue_from: int = 0,
    revenue_to: int | None = None,
    downloads_from: int = 0,
    description: str | None = None,
    country: str = "WW",
    sort: str = "revenue",
    limit: int = 50,
    offset: int = 0,
) -> str:
    """
    Search apps in AppMagic with filters.

    Args:
        store: Store to search in. 1=Google Play, 2=iPhone App Store, 3=iPad App Store.
        revenue_from: Minimum revenue (last 30 days, USD). Default 0.
        revenue_to: Maximum revenue (last 30 days, USD). Optional.
        downloads_from: Minimum downloads (last 30 days). Default 0.
        description: Filter apps whose description contains this word/phrase.
        country: Country/region code. Default "WW" (worldwide).
        sort: Sort field. One of: revenue, downloads, rating, name. Default "revenue".
        limit: Number of results to return (max 500). Default 50.
        offset: Pagination offset. Default 0.

    Returns:
        JSON list of apps with fields: united_id, name, publisher, store_ids,
        revenue_30d, downloads_30d, score, domain, release_date.
    """
    import datetime
    params = {
        "store": store,
        "country": country,
        "revenue_from": revenue_from,
        "revenue_to": revenue_to,
        "downloads_from": downloads_from,
        "description": description,
        "sort": sort,
        "size": min(limit, 500),
        "offset": offset,
        "release_date_gte": "2010-01-01",
        "release_date_lte": str(datetime.date.today()),
    }
    results = api_get("/tops/advanced-search", params)
    if not results:
        return "[]"

    apps = []
    for record in results:
        app = record.get("application") or record
        pub = app.get("united_publisher") or {}
        store_names = {1: "Google Play", 2: "iPhone App Store", 3: "iPad App Store"}
        domain_tag = next(
            (t["name"] for t in (app.get("tags") or []) if t.get("type") == "domain"),
            None,
        )
        apps.append({
            "united_id": app.get("id"),
            "name": app.get("name"),
            "publisher": pub.get("name") or app.get("publisher_name"),
            "store": store_names.get(store, str(store)),
            "store_ids": app.get("store_ids"),
            "revenue_30d": app.get("revenue"),
            "downloads_30d": app.get("downloads"),
            "score": app.get("score"),
            "release_date": (app.get("releaseDate") or "")[:10],
            "domain": domain_tag,
            "category_tags": [
                t["name"] for t in (app.get("tags") or []) if t.get("type") == "apps"
            ],
        })
    return json.dumps(apps, ensure_ascii=False, indent=2)


@mcp.tool()
def get_app_info(store: int, app_id: str) -> str:
    """
    Get basic app metrics for a specific app.

    Args:
        store: 1=Google Play, 2=iPhone App Store, 3=iPad App Store.
        app_id: Store-specific app identifier (e.g. "com.spotify.music" for Google Play,
                "324684580" for App Store).

    Returns:
        JSON with name, publisher, score, downloads, revenue, categories.
    """
    info = api_get(f"/applications/{store}/{app_id}")
    return json.dumps(info, ensure_ascii=False, indent=2)


@mcp.tool()
def get_app_details(store: int, app_id: str, country: str = "US") -> str:
    """
    Get detailed app info: description, price, languages, release date.

    Args:
        store: 1=Google Play, 2=iPhone App Store, 3=iPad App Store.
        app_id: Store-specific app identifier.
        country: Country for localized info. Default "US".

    Returns:
        JSON with description, price, currency, free, release_date, languages, etc.
    """
    result = api_post("/applications/app-info-v2", {
        "store": store,
        "store_application_id": app_id,
        "country": country,
    })
    data = (result or {}).get("data") or result or {}
    return json.dumps(data, ensure_ascii=False, indent=2)


@mcp.tool()
def get_app_sdks(store: int, app_id: str) -> str:
    """
    Get list of SDKs and third-party libraries detected in an app.

    Args:
        store: 1=Google Play, 2=iPhone App Store, 3=iPad App Store.
        app_id: Store-specific app identifier.

    Returns:
        JSON list of SDK objects with name, category, and detection date.
    """
    result = api_get("/sdkint/sdks", {"store": store, "store_application_id": app_id})
    return json.dumps(result or [], ensure_ascii=False, indent=2)


@mcp.tool()
def get_release_notes(store: int, app_id: str) -> str:
    """
    Get release history (version changelog) for an app.

    Args:
        store: 1=Google Play, 2=iPhone App Store, 3=iPad App Store.
        app_id: Store-specific app identifier.

    Returns:
        JSON list of releases with version, release_date, and notes (newest first).
    """
    result = api_get(f"/applications/{store}/{app_id}/release-notes")
    return json.dumps(result or [], ensure_ascii=False, indent=2)


@mcp.tool()
def get_audience_metrics(
    united_application_ids: list[int],
    country: str = "WW",
) -> str:
    """
    Get DAU (Daily Active Users) and MAU (Monthly Active Users) for one or more apps.

    Args:
        united_application_ids: List of AppMagic united application IDs (up to 100).
        country: Country/region code. Default "WW" (worldwide).

    Returns:
        JSON dict mapping united_application_id -> {dau, mau}.
    """
    import datetime

    date = str(datetime.date.today() - datetime.timedelta(days=2))
    body = {
        "united_application_ids": united_application_ids[:100],
        "date": date,
        "countries": [country],
        "store": 5,
    }

    dau_map: dict[int, int] = {}
    mau_map: dict[int, int] = {}

    dau_result = api_post("/history/united-applications-dau", body)
    if dau_result:
        for item in dau_result:
            uid = item.get("united_application_id")
            if uid:
                dau_map[uid] = item.get("dau") or 0

    time.sleep(0.3)

    mau_result = api_post("/history/united-applications-mau", body)
    if mau_result:
        for item in mau_result:
            uid = item.get("united_application_id")
            if uid:
                mau_map[uid] = item.get("mau") or 0

    result = {
        uid: {"dau": dau_map.get(uid, 0), "mau": mau_map.get(uid, 0)}
        for uid in united_application_ids
    }
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool()
def get_revenue_history(
    united_application_id: int,
    store: int,
    country: str = "US",
    date_from: str | None = None,
    date_to: str | None = None,
    aggregation: str = "monthly",
) -> str:
    """
    Get revenue + downloads history for an app using united_application_id.

    Args:
        united_application_id: AppMagic united app ID (from search_apps results).
        store: 1=Google Play, 2=iPhone App Store.
        country: Country code. Use "US" or "WW". Default "US".
        date_from: Start date YYYY-MM-DD. Default 90 days ago.
        date_to: End date YYYY-MM-DD. Default today.
        aggregation: "daily", "weekly", or "monthly". Default "monthly".

    Returns:
        JSON list of {date, revenue, downloads} records.
    """
    import datetime
    if not date_from:
        date_from = str(datetime.date.today() - datetime.timedelta(days=90))
    if not date_to:
        date_to = str(datetime.date.today())

    result = api_get("/history/united-application", {
        "united_application_id": united_application_id,
        "store": store,
        "country": country,
        "date_from": date_from,
        "date_to": date_to,
        "aggregation": aggregation,
    })
    return json.dumps(result or [], ensure_ascii=False, indent=2)


@mcp.tool()
def get_downloads_history(
    united_application_id: int,
    store: int,
    country: str = "US",
    date_from: str | None = None,
    date_to: str | None = None,
    aggregation: str = "monthly",
) -> str:
    """
    Get downloads history for an app using united_application_id.

    Args:
        united_application_id: AppMagic united app ID (from search_apps results).
        store: 1=Google Play, 2=iPhone App Store.
        country: Country code. Use "US" or "WW". Default "US".
        date_from: Start date YYYY-MM-DD. Default 90 days ago.
        date_to: End date YYYY-MM-DD. Default today.
        aggregation: "daily", "weekly", or "monthly". Default "monthly".

    Returns:
        JSON list of {date, downloads} records.
    """
    import datetime
    if not date_from:
        date_from = str(datetime.date.today() - datetime.timedelta(days=90))
    if not date_to:
        date_to = str(datetime.date.today())

    result = api_get("/history/united-application", {
        "united_application_id": united_application_id,
        "store": store,
        "country": country,
        "date_from": date_from,
        "date_to": date_to,
        "aggregation": aggregation,
    })
    # Extract only downloads field
    records = result or []
    return json.dumps(
        [{"date": r.get("date"), "downloads": r.get("downloads")} for r in records],
        ensure_ascii=False, indent=2
    )


@mcp.tool()
def get_ad_intelligence(
    app_ids: list[str],
    country: str = "US",
    date_from: str | None = None,
    date_to: str | None = None,
    aggregation: str = "month",
) -> str:
    """
    Get ad channel stats for one or more apps (which networks they advertise on).

    Args:
        app_ids: List of store app IDs (iOS numeric ID, e.g. ["571800810"]).
        country: Country code. Default "US".
        date_from: Start date YYYY-MM-DD. Default 6 months ago.
        date_to: End date YYYY-MM-DD. Default today.
        aggregation: "day", "week", or "month". Default "month".

    Returns:
        JSON with ad_sources (networks with weight), networks, and countries breakdown.
    """
    import datetime
    if not date_from:
        date_from = str(datetime.date.today() - datetime.timedelta(days=180))
    if not date_to:
        date_to = str(datetime.date.today())

    result = api_get("/adint/stats", {
        "appIds": app_ids,
        "country": country,
        "dateFrom": date_from,
        "dateTo": date_to,
        "aggregation": aggregation,
    })
    return json.dumps(result or {}, ensure_ascii=False, indent=2)


@mcp.tool()
def get_app_ads(
    app_ids: list[str],
    country: str,
    date_from: str,
    date_to: str,
    sort: str = "score",
    aggregation: str = "month",
    ad_network: str | None = None,
    platform: str | None = None,
    ad_type: str | None = None,
    count: int = 20,
    offset: int = 0,
) -> str:
    """
    Get ad creatives for one or more apps (actual creative assets).

    Args:
        app_ids: List of store app IDs, e.g. ["com.ovelin.guitartuna"] or ["527588389"].
        country: Country/region code, e.g. "WW", "US", "GB". Required.
        date_from: Start date in YYYY-MM-DD format. Required.
        date_to: End date in YYYY-MM-DD format. Required.
        sort: "score" (impressions) or "created_date". Default "score".
        aggregation: "day", "week", or "month". Default "month".
        ad_network: Filter by network: "facebook", "tiktok", "admob", "applovin",
                    "unity", "ironsource", "vungle", "chartboost", "pangle", etc.
        platform: "android" or "ios". Optional.
        ad_type: "video", "static", "html", "playable", "interstitialVideo",
                 "rewardedVideo", "web2app". Optional.
        count: Number of results (1-100). Default 20.
        offset: Pagination offset. Default 0.

    Returns:
        JSON list of ad creatives with id, type, ad_network, score, createdDate,
        lastSeenDate, videoUrl, videoScreenshot, htmlUrl, targetUrl.
    """
    params: dict = {
        "appIds": app_ids,
        "country": country,
        "dateFrom": date_from,
        "dateTo": date_to,
        "sort": sort,
        "aggregation": aggregation,
        "count": count,
        "offset": offset,
    }
    if ad_network:
        params["adNetwork"] = ad_network
    if platform:
        params["platform"] = platform
    if ad_type:
        params["type"] = ad_type

    result = api_get("https://api.appmagic.rocks/adint/application-ads", params)
    return json.dumps(result or [], ensure_ascii=False, indent=2)


@mcp.tool()
def get_creative_stats(
    creative_id: str,
    country: str = "WW",
) -> str:
    """
    Get detailed stats for a specific ad creative: impressions history,
    breakdown by country, networks, and apps where it was shown.

    Args:
        creative_id: Creative ID from get_app_ads results.
        country: Country/region code. Default "WW".

    Returns:
        JSON with creative details, impressions history, network/country breakdown.
    """
    result = api_get("https://api.appmagic.rocks/adint/creative-stats", {
        "id": creative_id,
        "country": country,
    })
    return json.dumps(result or {}, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    mcp.run()
