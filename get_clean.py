
import urllib.request
import urllib.parse
import json
import time

anime = ["Dragon Ball Z", "Naruto", "One Piece", "Dandadan", "Assassination Classroom", "Neon Genesis Evangelion", "Jujutsu Kaisen", "Cyberpunk Edgerunners", "Fullmetal Alchemist Brotherhood", "Inazuma Eleven", "Death Note", "Monster", "Serial Experiments Lain", "Sword Art Online", "Sailor Moon", "Madoka Magica", "Your Name", "Perfect Blue"]

def get_anilist(title):
    query = """
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        coverImage { extraLarge }
      }
    }
    """
    try:
        req = urllib.request.Request("https://graphql.anilist.co", data=json.dumps({"query": query, "variables": {"search": title}}).encode("utf-8"), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req)
        data = json.loads(res.read().decode())
        return data["data"]["Media"]["coverImage"]["extraLarge"]
    except Exception as e:
        print("AniList Error for", title, e)
        return None

results = []
for a in anime:
    img = get_anilist(a)
    if img:
        print(img)
        results.append(img)
    time.sleep(1)

with open("clean_covers.json", "w") as f:
    json.dump(results, f)

