import urllib.request
import urllib.parse
import json
import time

anime = ["Dragon Ball Z", "Naruto", "One Piece", "Dandadan", "Assassination Classroom", "Neon Genesis Evangelion", "Jujutsu Kaisen", "Cyberpunk: Edgerunners", "Fullmetal Alchemist: Brotherhood", "Inazuma Eleven", "Death Note", "Monster", "Serial Experiments Lain", "Sword Art Online", "Sailor Moon", "Puella Magi Madoka Magica", "Your Name", "Perfect Blue"]

def search_anime(query):
    try:
        url = 'https://api.jikan.moe/v4/anime?q=' + urllib.parse.quote(query) + '&limit=1'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode())
        if data['data']:
            return data['data'][0]['images']['jpg']['large_image_url']
    except Exception as e:
        print('Error:', e)
        pass
    return None

for item in anime:
    img = search_anime(item)
    if img:
        print(f'"{img}", // {item}')
    time.sleep(0.5)

