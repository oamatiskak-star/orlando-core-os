# Combi-foto's

Plaats hier de foto's voor de combi-catalogus van de Bouw Calculator
(`/dashboard/calculaties/calculator`). Elke combi-kaart toont automatisch
de bijbehorende foto zodra het bestand bestaat; ontbreekt het bestand,
dan valt de kaart terug op een gekleurd icoon.

## Vereisten
- **Formaat:** JPG (of WebP — pas dan ook `COMBI_FOTO` in `page.tsx` aan).
- **Aanbevolen afmeting:** ca. 600×400 px, liggend (4:3 / 3:2).
- **Rechten:** gebruik uitsluitend royalty-vrije / eigen foto's
  (bijv. Unsplash, Pexels, Wikimedia Commons of eigen werk).
  Kopieer **geen** beeld uit 2Jours/Raabcalc of andere licentiebibliotheken.

## Verwachte bestandsnamen
| Combi                  | Bestand                |
|------------------------|------------------------|
| Sloopwerk              | sloopwerk.jpg          |
| Fundering & Grondwerk  | fundering.jpg          |
| Metselwerk             | metselwerk.jpg         |
| Betonwerk              | betonwerk.jpg          |
| Riolering              | riolering.jpg          |
| Asbestsanering         | asbestsanering.jpg     |
| Dakwerk                | dakwerk.jpg            |
| Dakkapel & Dakraam     | dakkapel.jpg           |
| Isolatie               | isolatie.jpg           |
| Gevelrenovatie         | gevelrenovatie.jpg     |
| Kozijnen & Deuren      | kozijnen.jpg           |
| Stucwerk & Plafonds    | stucwerk.jpg           |
| Tegelwerk              | tegelwerk.jpg          |
| Vloerwerk              | vloerwerk.jpg          |
| Schilderwerk           | schilderwerk.jpg       |
| Timmerwerk             | timmerwerk.jpg         |
| Elektra                | elektra.jpg            |
| Loodgieterij           | loodgieterij.jpg       |
| CV-installatie         | cv-installatie.jpg     |
| Ventilatie & WTW       | ventilatie.jpg         |
| Zonnepanelen           | zonnepanelen.jpg       |
| Badkamer compleet      | badkamer.jpg           |
| Keukenplaatsing        | keuken.jpg             |
| Trap & Balustrade      | trap.jpg               |
| Bestrating & Terras    | bestrating.jpg         |
| Tuinafscheiding        | tuinafscheiding.jpg    |

De koppeling staat in `frontend/app/dashboard/calculaties/calculator/page.tsx`
in de constante `COMBI_FOTO`.
