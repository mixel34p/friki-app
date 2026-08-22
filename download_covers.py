import os
import time
import urllib.request
import json
import random

covers_dir = r'c:\Users\Equipo\Documents\friki-app\public\covers'
if not os.path.exists(covers_dir):
    os.makedirs(covers_dir)

games = [
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co2lbd.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co8fu7.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/cobqpd.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co30zf.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co2kx2.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/cobkt6.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1w9u.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/cob8m6.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1z21.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r76.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/coa93h.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/cobebu.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1x77.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co2wk8.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co8het.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1xlp.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1mxf.webp",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/cob8r9.webp"
]

anime = [
    "https://cdn.myanimelist.net/images/anime/1277/142022.jpg",
    "https://cdn.myanimelist.net/images/anime/1565/111305.jpg",
    "https://cdn.myanimelist.net/images/anime/1244/138851.jpg",
    "https://cdn.myanimelist.net/images/anime/1584/143719.jpg",
    "https://cdn.myanimelist.net/images/anime/5/75639.jpg",
    "https://cdn.myanimelist.net/images/anime/1314/108941.jpg",
    "https://cdn.myanimelist.net/images/anime/1171/109222.jpg",
    "https://cdn.myanimelist.net/images/anime/1818/126435.jpg",
    "https://cdn.myanimelist.net/images/anime/1208/94745.jpg",
    "https://cdn.myanimelist.net/images/anime/1854/94704.jpg",
    "https://cdn.myanimelist.net/images/anime/1079/138100.jpg",
    "https://cdn.myanimelist.net/images/anime/10/18793.jpg",
    "https://cdn.myanimelist.net/images/anime/1718/91550.jpg",
    "https://cdn.myanimelist.net/images/anime/11/39717.jpg",
    "https://cdn.myanimelist.net/images/anime/1440/92258.jpg",
    "https://cdn.myanimelist.net/images/anime/11/55225.jpg",
    "https://cdn.myanimelist.net/images/anime/5/87048.jpg",
    "https://cdn.myanimelist.net/images/anime/1254/134212.jpg"
]

all_items = games + anime
local_paths = []

for i, url in enumerate(all_items):
    ext = url.split('.')[-1]
    filename = f"cover_{i}.{ext}"
    filepath = os.path.join(covers_dir, filename)
    local_url = f"/covers/{filename}"
    local_paths.append(local_url)
    
    if not os.path.exists(filepath):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Downloaded {filename}")
        except Exception as e:
            print(f"Error downloading {url}: {e}")
        time.sleep(0.5)

# Shuffle
random.seed(42) # fixed seed for consistency or just let it randomize
random.shuffle(local_paths)

print("\n--- NEW JS ARRAY ---")
print("const STATIC_COVERS = [")
for path in local_paths:
    print(f'    "{path}",')
print("];")
