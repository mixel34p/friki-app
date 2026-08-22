import urllib.request
import urllib.parse
import json
import time

games = ["Grand Theft Auto V", "The Legend of Zelda: Breath of the Wild", "Minecraft", "Sonic Adventure 2", "Kingdom Hearts", "Final Fantasy VII", "God of War", "Kirby & The Amazing Mirror", "Animal Crossing: New Leaf", "Pokemon Black", "Persona 5 Royal", "Stardew Valley", "Hollow Knight: Silksong", "Elden Ring", "The Last of Us", "Halo 2", "Resident Evil 4", "Five Nights at Freddy's", "OMORI", "Super Mario Odyssey", "Splatoon 2"]
anime = ["Dragon Ball Z", "Naruto", "One Piece", "Dandadan", "Assassination Classroom", "Neon Genesis Evangelion", "Jujutsu Kaisen", "Cyberpunk: Edgerunners", "Fullmetal Alchemist: Brotherhood", "Inazuma Eleven", "Death Note", "Monster", "Serial Experiments Lain", "Sword Art Online", "Sailor Moon", "Puella Magi Madoka Magica", "Your Name", "Perfect Blue"]

def get_img(title):
    try:
        url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_'))
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode())
        if 'originalimage' in data:
            return data['originalimage']['source']
    except:
        pass
    return None

results = []
for title in games + anime:
    img = get_img(title)
    if not img:
        img = get_img(title + ' (video game)')
    if not img:
        img = get_img(title + ' (anime)')
    if not img:
        img = get_img(title + ' (manga)')
    if img:
        results.append(img)
    time.sleep(0.1)

with open('covers.json', 'w') as f:
    json.dump(results, f)
