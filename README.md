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

## Online (GitHub Pages)

- **Live site:** https://cwcheng2009.github.io/lake-temple/
- **Code:** https://github.com/cwcheng2009/lake-temple (public; GitHub account `cwcheng2009`)
- My other site, [maple-lake](https://cwcheng2009.github.io/maple-lake/), is a separate repository and is not affected by this one.

This is already set up (October 2026). Publishing uses the `gh` command-line tool (installed with Homebrew and logged in), not GitHub Desktop.

**To publish a change:** ask Claude (in the Code tab) to "push it online". Claude commits the change and pushes it to `main`. The workflow in `.github/workflows/deploy.yml` then builds the site, and it is live in about 30 seconds.

To do it yourself in the terminal:

```bash
git add -A && git commit -m "Describe the change" && git push
```

Size limits: each Pages site can be up to 1 GB, with about 100 GB of traffic a month; a single file can't be over 100 MB. This site is about 1 MB. Keep a Tripo3D model under ~20 MB so the page loads quickly.

The local folder (`Desktop/udemy touch designer/Lake Tempo 3D Soundscape`) and GitHub are two separate copies. They only match after a push. GitHub also acts as a backup.

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
