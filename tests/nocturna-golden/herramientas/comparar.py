"""
Pone lado a lado el diseño (capturas-diseno/) y la implementación
(capturas/<dispositivo>/), recortando la implementación a lo que se ve sin
scrollear: el lienzo del diseño también muestra una sola pantalla.

    node tests/nocturna-golden/herramientas/capturar-diseno.mjs
    npx playwright test -c tests/nocturna-golden calidad --project=iphone-14 --project=desktop-1440
    python tests/nocturna-golden/herramientas/comparar.py

Necesita Pillow (pip install pillow). Deja las imágenes en comparacion/.
"""
from pathlib import Path
from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent.parent
SALIDA = AQUI / 'comparacion'
SALIDA.mkdir(exist_ok=True)

# (dispositivo de las pruebas, prefijo del diseño, alto de la pantalla en px CSS, escala de la captura)
VISTAS = [('iphone-14', 'iphone', 844, 3), ('desktop-1440', 'desktop', 900, 1)]
PARES = [
    ('00-bienvenida', '00-bienvenida'),
    ('02-chicos', '02b-chicos-cargados'),
    ('02c-sumando', '12-modo-sumar-chicos'),
    ('08-entrada', '08-entrada'),
]
ALTO = 1400

for disp, pref, alto_css, escala in VISTAS:
    for diseno, impl in PARES:
        a = AQUI / 'capturas-diseno' / f'{pref}--{diseno}.png'
        b = AQUI / 'capturas' / disp / f'{impl}.png'
        if not a.exists() or not b.exists():
            print('falta', a.name if not a.exists() else b)
            continue
        ia = Image.open(a).convert('RGB')
        ib = Image.open(b).convert('RGB')
        ib = ib.crop((0, 0, ib.width, min(ib.height, alto_css * escala)))
        ia = ia.resize((round(ia.width * ALTO / ia.height), ALTO))
        ib = ib.resize((round(ib.width * ALTO / ib.height), ALTO))
        lienzo = Image.new('RGB', (ia.width + ib.width + 60, ALTO + 70), (26, 26, 26))
        lienzo.paste(ia, (20, 60))
        lienzo.paste(ib, (ia.width + 40, 60))
        d = ImageDraw.Draw(lienzo)
        d.text((20, 20), f'DISEÑO · {diseno}', fill=(255, 255, 255))
        d.text((ia.width + 40, 20), f'IMPLEMENTACIÓN · {disp} · {impl}', fill=(255, 255, 255))
        destino = SALIDA / f'{disp}--{impl}.png'
        lienzo.save(destino)
        print(destino.name)
