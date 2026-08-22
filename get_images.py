from duckduckgo_search import DDGS
import time
import json

games = ["GTA V cover IGDB", "Zelda BOTW cover IGDB", "Minecraft cover IGDB", "Sonic Adventure 2 cover IGDB", "Kingdom Hearts cover IGDB", "FF VII cover IGDB", "God of War cover IGDB", "Kirby Amazing Mirror cover IGDB", "Animal Crossing New Leaf cover IGDB", "Pokemon Blanco cover IGDB", "Persona 5 Royal cover IGDB", "Stardew Valley cover IGDB", "Silk Song cover IGDB", "Elden Ring cover IGDB", "Last of Us cover IGDB", "Halo 2 cover IGDB", "Resident Evil 4 cover IGDB", "Fnaf cover IGDB", "OMORI cover IGDB", "Mario Odyssey cover IGDB", "Splatoon 2 cover IGDB"]

anime = ["Dragon Ball Z poster myanimelist", "Naruto poster myanimelist", "One Piece poster myanimelist", "Dan da dan poster myanimelist", "Assisination Classroom poster myanimelist", "Neon Genesis Evangelion poster myanimelist", "Jujutsu Kaisen poster myanimelist", "Cyberpunk Edgerunners poster myanimelist", "Full Metal Alchemist poster myanimelist", "Inazuma Eleven poster myanimelist", "Death Note poster myanimelist", "Monster poster myanimelist", "Serial Experiments Lain poster myanimelist", "Sword Art Online poster myanimelist", "Sailor Moon poster myanimelist", "Madoka Magica poster myanimelist", "Your Name poster myanimelist", "Perfect Blue poster myanimelist"]

all_items = games + anime
results = []

with DDGS() as ddgs:
    for item in all_items:
        try:
            images = list(ddgs.images(item, max_results=1))
            if images:
                print(f'"{images[0]["image"]}", // {item}')
                results.append(images[0]["image"])
        except Exception as e:
            print(f"Error for {item}: {e}")
        time.sleep(1)

with open('covers.json', 'w') as f:
    json.dump(results, f)

