# Lake Temple · 湖畔古寺

A 3D soundscape website: a temple on a lake at night. Every sound is placed in 3D space, so as you move the camera the bell, wind chimes, crickets and water move around you. Built with [Three.js](https://threejs.org) and the Web Audio API. The sound is made in code, so no audio files are needed.

## Run it on your computer

You need [Node.js](https://nodejs.org) (already installed on this Mac).

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:5173). When you save a change to the code, the page reloads by itself.

## What's in the scene

| Thing | Sound | Click it |
|---|---|---|
| Temple bell (right side, under the small roof) | Rings every 1–1.5 minutes | Rings the bell |
| Hall | Low "Om" chant drone | Chants a phrase |
| Lanterns | – | Rings a chime |
| Lake | Soft wash, plus waves lapping at the platform | Water drop and a ripple |
| Roof corners | Wind chimes; more of them when the wind gusts | – |
| Shore | Crickets, frogs, leaves rustling, an owl now and then | – |

Keys: **B** bell · **M** mute · **H** hide the interface. Use the **Mixer** button to change each layer's volume.

## Use your own temple model (Tripo3D)

1. In Tripo3D, generate a temple. Prompt idea: *"Japanese wooden temple hall, two-tier curved roof, red pillars, paper lanterns, low poly, game asset"*.
2. Export as **GLB** (`.glb`). If there's a size option, pick the lower poly count; under ~10 MB loads well on the web.
3. Rename the file to `temple.glb` and put it in `public/models/`.
4. Reload the page. Your model replaces the built-in hall. The platform, bell tower, bridge and torii gate stay.
5. Adjust it in [`src/config.js`](src/config.js):
   - `size`: how wide it is in metres
   - `rotationY`: turn it to face the camera (try 90, 180 or 270)
   - `position`: move it around
   - `hideBuiltInHall: false`: keep both, for comparing

If the file is large (over ~15 MB), you can shrink it:

```bash
npx @gltf-transform/cli optimize public/models/temple.glb public/models/temple.glb --compress meshopt --texture-compress webp
```

You can add other models (a boat, more trees, statues) the same way later; ask Claude to load them.

## Using recorded sounds instead

The synthesised layers live in [`src/audio/soundscape.js`](src/audio/soundscape.js). To use real recordings (field recordings of water or a real temple bell, for example), put `.mp3` files in `public/audio/` and ask Claude to swap a layer to play the file at the same 3D position.

## Put it online with GitHub Pages

This only needs to be set up once. After that, every change you push goes live in about a minute.

1. Create a free account at [github.com](https://github.com) and install [GitHub Desktop](https://desktop.github.com).
2. In GitHub Desktop: **File → Add Local Repository →** choose this folder. When it says it isn't a repository yet, click **create a repository**.
3. Click **Publish repository**. Untick "Keep this code private" if you want the code public. (Pages on a free account requires a public repository.)
4. On github.com, open the repository → **Settings → Pages →** under *Build and deployment*, set **Source** to **GitHub Actions**.
5. Back in GitHub Desktop, make any small change, then **Commit** and **Push**. The workflow in `.github/workflows/deploy.yml` builds the site and publishes it.
6. The site address appears in **Settings → Pages**. It looks like `https://YOUR-NAME.github.io/REPO-NAME/`.

## Project layout

```
index.html               page and interface
src/main.js              renderer, camera, clicking, main loop
src/config.js            ← settings you're likely to change
src/world/sky.js         night sky, stars, moon, mountains
src/world/water.js       reflective lake
src/world/landscape.js   shore, trees, rocks
src/world/temple.js      built-in temple, bell tower, bridge, torii
src/world/atmosphere.js  fireflies, mist, petals, ripples
src/world/model.js       loads your .glb model
src/audio/soundscape.js  all sounds (3D-positioned Web Audio)
public/models/           put temple.glb here
```
