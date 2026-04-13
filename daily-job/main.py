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

        # Optional: keep your serialization check if helpful
        # ...

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
