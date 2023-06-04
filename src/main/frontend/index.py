import http.client

conn = http.client.HTTPSConnection("api.sportradar.us")

teams = []
players = []

# Get all teams in MLB
conn.request("GET", "http://api.sportradar.us/mlb/trial/v7/en/league/hierarchy.json?api_key=5xe3garccysh3rq94phd76zn")
response = conn.getresponse()
teams = response.read()

print(teams.decode("utf-8"))

# Get all team rosters and input all players into one array
conn.request("GET", "http://api.sportradar.us/mlb/trial/v7/en/teams/aa34e0ed-f342-4ec6-b774-c79b47b60e2d/depth_chart.json?api_key=5xe3garccysh3rq94phd76zn")
response = conn.getresponse()
team = response.read()

# print(team.decode("utf-8"))

# Get random player from array


# Get player info
conn.request("GET", "http://api.sportradar.us/mlb/trial/v7/en/players/46734ad0-e55b-4e2f-8a0d-72387470fcdf/profile.json?api_key=5xe3garccysh3rq94phd76zn")
response = conn.getresponse()
player = response.read()

# print(player.decode("utf-8"))
