# The Curiosity Institute

The Curiosity Institute is a casual museum management game built around direct avatar control.

The player is **the curator**: a small on-floor character moving through the museum in real time, collecting coin pickups, responding to visitors, opening rooms, and handling live public-question events.

This README is now focused on the **main 3D gameplay** only.

## Core Fantasy

The game should feel like:

- running a cozy museum with the readability of a premium mobile tycoon game
- physically moving the curator through the space instead of only tapping menus
- watching visitors flow through rooms while the museum grows wing by wing
- making the museum feel intelligent and alive through questions, reviews, and guided expansion

## Main Gameplay Loop

1. Guide the curator through the museum floor in a top-down 3D view.
2. Collect ticket income and exhibit income as coins pop into the world.
3. Watch tourists enter rooms, gather around highlights, and reveal demand.
4. Unlock and expand new rooms over time.
5. React to live events, especially **Call the Curator** questions from the public.

The crucial difference is that the museum is not just a menu tree. The curator is present on the floor, and the player reads the museum through movement, flow, and spatial priorities.

## Additional Gameplay: Call the Curator

One mechanic added to the concept is **Call the Curator**.

During normal play, the curator can receive incoming public questions, inspired by the British Museum's **History Hotline** concept.

That means:

- a live call event can appear while the player is already managing the floor
- the caller is a member of the public asking a history or museum-related question
- the event should feel like part of the museum fantasy, not a detached quiz menu
- good answers can improve reputation, curiosity, or demand for specific exhibition branches

Visually, the mechanic is represented in the gameplay concepts as a **handset icon with a question mark** above the curator.

## Three Independent Main 3D Gameplay Directions

These three concept images were generated from **three separate Nano Banana prompts**, not by chaining one output into the next.

They all show the same gameplay idea:

- portrait mobile framing
- direct control of the curator
- floating coin pickups
- active exhibit or public room space
- visible locked future expansion
- incoming public-question call event

But each direction has a clearly different visual language.

### Direction 1: Heritage Hall

This direction is the closest to the premium boutique-hotel-management feel:

- dark green striped walls
- pale parquet floors
- burgundy runner
- brass lamps and trim
- warm heritage-museum atmosphere

Why it works:

- very readable corridor-first gameplay
- strong contrast between active room and locked room
- immediately feels like a management game space

![Direction 1: Heritage Hall](docs/concept-art/gameplay-directions/direction-1-heritage-hall.png)

### Direction 2: Marble Atrium

This direction leans into civic grandeur:

- white stone and marble architecture
- skylit upper structure
- teal runner
- brighter daylight mood
- more formal institutional feeling

Why it works:

- strongest “national museum” tone
- very clean top-down read
- the call-event icon is easy to notice in the center lane

![Direction 2: Marble Atrium](docs/concept-art/gameplay-directions/direction-2-marble-atrium.png)

### Direction 3: Glasshouse Museum

This direction pushes toward a lighter, more family-friendly conservatory feel with a different floorplan:

- brass-framed glass partitions
- terracotta and pale stone flooring
- indoor plants and warm daylight
- softer modern museum mood
- central rotunda hub instead of a straight corridor

Why it works:

- most distinct gameplay silhouette of the three
- strong “curiosity institute” identity
- feels welcoming, modern, and expandable
- suggests a hub-and-spoke museum structure instead of a linear wing

![Direction 3: Glasshouse Museum](docs/concept-art/gameplay-directions/direction-3-glasshouse-museum.png)

## Recommended Reading Of The Three

If choosing between them:

- **Heritage Hall** is best for a tight classic room-stack tycoon layout.
- **Marble Atrium** is best for prestige and a clean central-lane management read.
- **Glasshouse Museum** is best for a hub-and-spoke museum structure with stronger brand identity.

My current read:

- Heritage Hall is the safest familiar tycoon layout.
- Marble Atrium is the cleanest premium-mobile presentation.
- Glasshouse Museum is the boldest structural departure.

## Direction Constraints Going Forward

Whichever direction is chosen, the main gameplay should keep these rules:

- the player always controls **the curator** directly on the floor
- the main camera is a three-quarter top-down portrait view
- the museum is structured as readable dollhouse-like rooms around a clear main route or hub
- income appears as collectible in-world feedback
- future expansions are spatially visible, not hidden in menus
- public-question call events are integrated into normal movement and flow

## Files

Main gameplay directions live in:

- `docs/concept-art/gameplay-directions/direction-1-heritage-hall.png`
- `docs/concept-art/gameplay-directions/direction-2-marble-atrium.png`
- `docs/concept-art/gameplay-directions/direction-3-glasshouse-museum.png`

Generation helper:

- `scripts/render-concept-art.mjs`

This brief is intentionally focused on the **main 3D gameplay presentation** and the **Call the Curator** mechanic.
