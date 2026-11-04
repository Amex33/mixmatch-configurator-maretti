# 3D-modellen voor de configurator

Bron: de SketchUp-exports van Maretti in `mixenmatch/3D` (buiten `public`, niet online).
Uitvoer: `public/models/*.glb` (één lamp per maat, ware grootte in meters) en `public/models/models.json`.

    pip install trimesh numpy scipy
    python tools/3d/extract.py ../3D public/models tools/3d

Per model staat in `extract.py` welk materiaal de kap is, welke maat we zoeken en welke onderdelen
(fitting, houder, goud, licht) erbij horen. Een nieuw model toevoegen: zip uitpakken in `mixenmatch/3D`,
een regel toevoegen aan `CFG` en in `resources/js/configurator/Viewer3D.tsx` aan `modelFor` koppelen.

Inciso heeft geen 3D-bestand; `inciso.py` bouwt de bol na uit de productfoto's en maten (Ø150 mm):

    python tools/3d/inciso.py public/models

Icosa S, M en L (13.0600, 13.0603, 13.0606) hebben ook geen 3D-bestand; `icosa.py` draait het profiel uit de maattekeningen op de server (`pip install pymupdf`):

    python tools/3d/icosa.py public/models

Cristallo (400.0001.80) is een onregelmatig kristal: `cristallo.py` maakt facetten binnen het silhouet van de productfoto (90 x 137 mm):

    python tools/3d/cristallo.py public/models

Zen (400.0009.05, 400.0010.05, 400.0011.05) is een stoffen lampion: `zen.py` draait de profielen uit de TK1-tekeningen in de Webshop-map (400.0011.05 uit de productfoto):

    python tools/3d/zen.py public/models

Ozone (13.0440, glas 80.1275) is een buis Ø60 x 460 mm met craquelé-glas: `ozone.py` maakt de groeven met een vast celpatroon:

    python tools/3d/ozone.py public/models

Johnnie (13.0480, glas 80.1420) is een kap Ø90 x 120 mm met geslepen ruiten: `johnnie.py`, maten uit de TK1 in de Webshop-map:

    python tools/3d/johnnie.py public/models

Felice (400.0002.06, ook de kappen van .07/.08/.09) is verfrommeld glas onder een ring, 108 x 160 mm: `felice.py`, vorm naar de productfoto's:

    python tools/3d/felice.py public/models
