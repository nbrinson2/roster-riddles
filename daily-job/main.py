import functions_framework
import requests
import json
from google.cloud import firestore
from datetime import datetime, timezone
import time

# Firestore client - using your named database
db = firestore.Client(database="roster-riddles")

MLB_API = "https://statsapi.mlb.com/api/v1"

# Attributes to color-map (from your TS enum, excluding name & colorMap)
COLORABLE_ATTRS = [
    "team",  # CHW
    "lgDiv",  # AL East
    "b",  # R/L/S
    "t",  # R/L/B
    "born",  # Ven., Dom., etc.
    "age",
    "pos",
]

# Quick country abbreviation map (expand as needed)
# Firestore max document size is 1 MiB — shard payloads (encoded size can exceed json.dumps)
CAREER_PATH_META_DOC = "career_path_players_snapshot_meta"
# Distinct from legacy doc id `career_path_players_snapshot` (no shared prefix confusion)
CAREER_PATH_SHARD_PREFIX = "career_path_shard_"
CAREER_PATH_LEGACY_DOC = "career_path_players_snapshot"
# Conservative: protobuf field overhead can exceed raw JSON length
MAX_CAREER_PATH_SHARD_BYTES = 350_000

COUNTRY_ABBR_MAP = {
    "Venezuela": "Ven",
    "Dominican Republic": "Dom",
    "Cuba": "Cub",
    "Puerto Rico": "P.R.",
    "United States": "USA",
    "Japan": "Jpn",
    "Canada": "Can",
    "Mexico": "Mex",
    "Colombia": "Col",
    "Panama": "Pan",
    # Add more as you see in data
}


def _career_path_shard_document_size(players_chunk: list) -> int:
    payload = {"players": players_chunk, "shardIndex": 0}
    return len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))


def compute_career_path_shards(players: list, max_bytes: int = MAX_CAREER_PATH_SHARD_BYTES) -> list:
    """Split players into chunks so each Firestore document stays under ~1 MiB."""
    if not players:
        return []
    shards = []
    start = 0
    n = len(players)
    while start < n:
        lo, hi = start + 1, n
        best = start + 1
        while lo <= hi:
            mid = (lo + hi) // 2
            size = _career_path_shard_document_size(players[start:mid])
            if size <= max_bytes:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1
        if best == start:
            raise ValueError(
                f"Career-path player at index {start} cannot fit in one document; "
                "shorten data or raise MAX_CAREER_PATH_SHARD_BYTES."
            )
        shards.append(players[start:best])
        start = best
    return shards


def refine_shards_if_needed(
    shards: list, hard_max_bytes: int = 950_000
) -> list:
    """Second pass: greedily split any chunk that still exceeds hard_max_bytes."""
    out = []
    for chunk in shards:
        if _career_path_shard_document_size(chunk) <= hard_max_bytes:
            out.append(chunk)
            continue
        acc = []
        for p in chunk:
            trial = acc + [p]
            if _career_path_shard_document_size(trial) <= hard_max_bytes:
                acc = trial
            else:
                if acc:
                    out.append(acc)
                acc = [p]
                if _career_path_shard_document_size(acc) > hard_max_bytes:
                    raise ValueError(
                        "Single career-path player record exceeds Firestore size limit"
                    )
        if acc:
            out.append(acc)
    return out


def merge_teams(existing_teams: list, new_teams: list) -> None:
    """Match CareerPathPlayerGenerator.mergeTeams — extend stints when same team & years touch/overlap."""
    for incoming in new_teams:
        match = None
        for t in existing_teams:
            if (
                t["team"] == incoming["team"]
                and incoming["yearStart"] <= t["yearEnd"] + 1
                and incoming["yearEnd"] >= t["yearStart"] - 1
            ):
                match = t
                break
        if match:
            match["yearStart"] = min(match["yearStart"], incoming["yearStart"])
            match["yearEnd"] = max(match["yearEnd"], incoming["yearEnd"])
        else:
            existing_teams.append(
                {
                    "team": incoming["team"],
                    "yearStart": incoming["yearStart"],
                    "yearEnd": incoming["yearEnd"],
                }
            )


def get_career_path_players_by_season(year: int, roster_delay: float = 0.12) -> list:
    """
    Equivalent to CareerPathPlayerGenerator.getCareerPathPlayersBySeason(year).
    Returns list of { id, name, teams: [{ team, yearStart, yearEnd }] }.
    """
    teams_resp = requests.get(
        f"{MLB_API}/teams", params={"sportId": 1, "season": year}, timeout=60
    )
    teams_resp.raise_for_status()
    teams = teams_resp.json().get("teams", [])
    team_name_map = {t["id"]: t.get("name", "") for t in teams}

    out = []
    for team in teams:
        tid = team["id"]
        try:
            roster_resp = requests.get(
                f"{MLB_API}/teams/{tid}/roster",
                params={"season": year},
                timeout=60,
            )
            roster_resp.raise_for_status()
            roster = roster_resp.json().get("roster", [])
        except Exception as err:
            print(f"Failed roster for team {tid} ({team_name_map.get(tid)}) in {year}: {err}")
            continue

        for slot in roster:
            person = slot.get("person", {})
            pid = person.get("id")
            if not pid:
                continue
            out.append(
                {
                    "id": pid,
                    "name": person.get("fullName", ""),
                    "teams": [
                        {
                            "team": team_name_map.get(tid, ""),
                            "yearStart": year,
                            "yearEnd": year,
                        }
                    ],
                }
            )
        time.sleep(roster_delay)

    return out


def get_merged_players_since_1990(
    start_year: int = 1990,
    year_gap_delay: float = 0.25,
    roster_delay: float = 0.12,
) -> list:
    """
    Equivalent to CareerPathPlayerGenerator.getMergedPlayersSince1990() (no mlbDebutDate filter).
    """
    current_year = datetime.now().year
    all_rows = []

    for year in range(start_year, current_year + 1):
        print(f"Career path: fetching season {year}...")
        season_players = get_career_path_players_by_season(year, roster_delay=roster_delay)
        all_rows.extend(season_players)
        time.sleep(year_gap_delay)

    by_id = {}
    for p in all_rows:
        pid = p["id"]
        if pid not in by_id:
            by_id[pid] = {
                "id": pid,
                "name": p["name"],
                "teams": [{"team": t["team"], "yearStart": t["yearStart"], "yearEnd": t["yearEnd"]} for t in p["teams"]],
            }
        else:
            merge_teams(by_id[pid]["teams"], p["teams"])

    return list(by_id.values())


@functions_framework.http
def update_mlb_players_snapshot(request):
    print(
        f"MLB players snapshot job started at {datetime.now(timezone.utc).isoformat()}"
    )

    try:
        # Step 1: Get all MLB teams
        teams_resp = requests.get(f"{MLB_API}/teams", params={"sportId": 1})
        teams_resp.raise_for_status()
        teams = teams_resp.json()["teams"]

        # Filter active MLB teams
        mlb_teams = [
            t for t in teams if t.get("activeStatus") == "Active" or t.get("clubName")
        ]

        all_players = []

        # Step 2: Fetch 40-man rosters
        for team in mlb_teams:
            team_id = team["id"]
            team_abbr = team.get("abbreviation", "???")  # e.g. CHW
            division_full = team.get("division", {}).get("name", "Unknown")
            division_map = {
                "American League East": "AL East",
                "American League Central": "AL Central",
                "American League West": "AL West",
                "National League East": "NL East",
                "National League Central": "NL Central",
                "National League West": "NL West",
            }
            lg_div = division_map.get(division_full, division_full)

            roster_resp = requests.get(
                f"{MLB_API}/teams/{team_id}/roster",
                params={"rosterType": "active", "season": datetime.now().year},
            )
            roster_resp.raise_for_status()
            roster = roster_resp.json().get("roster", [])

            for slot in roster:
                person = slot.get("person", {})
                pid = person.get("id")
                if not pid:
                    continue

                all_players.append(
                    {
                        "id": pid,
                        "teamAbbr": team_abbr,
                        "lgDiv": lg_div,
                        "position": slot.get("position", {}).get("abbreviation", "?"),
                    }
                )

            time.sleep(0.35)

        print(f"Collected {len(all_players)} players from rosters")

        # Step 3: Batch enrich player details
        enriched_players = []
        player_ids = [p["id"] for p in all_players]
        batch_size = 50

        for i in range(0, len(player_ids), batch_size):
            batch = player_ids[i : i + batch_size]
            ids_str = ",".join(map(str, batch))

            resp = requests.get(
                f"{MLB_API}/people",
                params={
                    "personIds": ids_str,
                    "hydrate": "person,stats(group=hitting,type=season)",
                },
            )
            resp.raise_for_status()
            people = resp.json().get("people", [])

            for person in people:
                match = next((p for p in all_players if p["id"] == person["id"]), None)
                if not match:
                    continue

                bat_side = person.get("batSide", {}).get("description", "")
                throw_side = person.get("pitchHand", {}).get("description", "")
                birth_country = person.get("birthCountry", "")

                # Map to single letters
                b = {"Right": "R", "Left": "L", "Switch": "S"}.get(bat_side, "?")

                t = {"Right": "R", "Left": "L", "Both": "B"}.get(throw_side, "?")

                # Country abbr
                born = COUNTRY_ABBR_MAP.get(
                    birth_country, birth_country[:3].upper() if birth_country else "?"
                )

                enriched = {
                    **match,
                    "fullName": person.get("fullName", "Unknown"),
                    "currentAge": person.get("currentAge"),
                    "b": b,
                    "t": t,
                    "born": born,
                }
                enriched_players.append(enriched)

            time.sleep(0.45)

        print(f"Enriched {len(enriched_players)} players")

        # Step 4: Build final UI shape
        ui_players = []
        for p in enriched_players:
            ui_players.append(
                {
                    "name": p.get("fullName", "Unknown"),
                    "team": p.get("teamAbbr", "???"),  # CHW, ATL, etc.
                    "lgDiv": p.get("lgDiv", "?"),  # AL East, NL Central, etc.
                    "b": p.get("b", "?"),
                    "t": p.get("t", "?"),
                    "born": p.get("born", "?"),
                    "age": str(p.get("currentAge", "?")),
                    "pos": p.get("position", "?"),
                    "colorMap": {attr: "NONE" for attr in COLORABLE_ATTRS},
                }
            )

        print(f"Number of players: {len(ui_players)}")
        if ui_players:
            print("Sample player (first one):")
            print(json.dumps(ui_players[0], default=str))

        # Step 5: Store
        doc_ref = db.collection("cache").document("mlb_players_snapshot")
        doc_ref.set(
            {
                "players": ui_players,
                "lastUpdated": firestore.SERVER_TIMESTAMP,
                "count": len(ui_players),
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

        print(f"Successfully stored {len(ui_players)} players in Firestore")
        return "OK - Snapshot updated"

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return f"Error: {str(e)}", 500


@functions_framework.http
def update_career_path_players_snapshot(request):
    """
    Builds merged career-path data (1990 → current season) like CareerPathPlayerGenerator.getMergedPlayersSince1990
    and writes cache/career_path_players_snapshot.

    Does not apply getCareerPathPlayersSince1990's MLB debut-date filter (would require per-player /people calls).
    """
    print(
        f"Career path snapshot job started at {datetime.now(timezone.utc).isoformat()}"
    )
    try:
        print("career_path_job=shard_v2 doc_prefix=career_path_shard_")
        players = get_merged_players_since_1990()
        print(f"Merged career-path rows: {len(players)} unique players")

        shards = refine_shards_if_needed(compute_career_path_shards(players))
        print(
            f"Sharding career path into {len(shards)} document(s) "
            f"(target ~{MAX_CAREER_PATH_SHARD_BYTES} json bytes each)"
        )
        for si, sh in enumerate(shards):
            print(
                f"  shard {si}: {len(sh)} players, "
                f"~{_career_path_shard_document_size(sh)} json bytes"
            )

        cache = db.collection("cache")
        old_meta = cache.document(CAREER_PATH_META_DOC).get()
        old = old_meta.to_dict() if old_meta.exists else {}
        old_shard_count = int(old.get("shardCount", 0))
        old_prefix = old.get("shardDocPrefix") or CAREER_PATH_SHARD_PREFIX

        # 1) Write shard bodies first (client must not read meta until complete)
        for i, shard_players in enumerate(shards):
            cache.document(f"{CAREER_PATH_SHARD_PREFIX}{i}").set(
                {"players": shard_players, "shardIndex": i}
            )

        # 2) Meta last — points readers at shards
        meta_payload = {
            "shardCount": len(shards),
            "shardDocPrefix": CAREER_PATH_SHARD_PREFIX,
            "formatVersion": 2,
            "count": len(players),
            "lastUpdated": firestore.SERVER_TIMESTAMP,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "startYear": 1990,
            "endYear": datetime.now().year,
        }
        cache.document(CAREER_PATH_META_DOC).set(meta_payload)

        # 3) Remove legacy monolithic document + orphan shard docs from older layouts
        legacy_ref = cache.document(CAREER_PATH_LEGACY_DOC)
        if legacy_ref.get().exists:
            legacy_ref.delete()

        orphan_prefixes = list(
            dict.fromkeys(
                [
                    CAREER_PATH_SHARD_PREFIX,
                    "career_path_players_snapshot_",
                    old_prefix,
                ]
            )
        )
        for j in range(len(shards), old_shard_count):
            for prefix in orphan_prefixes:
                ref = cache.document(f"{prefix}{j}")
                if ref.get().exists:
                    ref.delete()

        print(
            f"Stored career path: {len(players)} players in {len(shards)} shard(s)"
        )
        return "OK - Career path snapshot updated", 200

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return f"Error: {str(e)}", 500
