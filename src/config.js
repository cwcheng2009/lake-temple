// ─────────────────────────────────────────────────────────────
//  Settings you are likely to change
// ─────────────────────────────────────────────────────────────

// Your own temple model (for example exported from Tripo3D as .glb).
// Put the file at  public/models/temple.glb  and reload the page.
// If the file is missing, the built-in temple made from code is shown instead.
export const TEMPLE_MODEL = {
  url: 'models/temple.glb',
  size: 20,              // fit the model's widest side to this many metres (built-in hall is ~21 m)
  position: [0, 1.2, -2], // x, y (height), z — 1.2 is the top of the stone platform
  rotationY: 0,          // degrees; turn the model to face the camera (try 90, 180, 270)
  hideBuiltInHall: true, // hide the code-made hall when your model loads
};

// Where the moon sits in the sky (direction, not position).
export const MOON_DIRECTION = [-0.32, 0.22, -1];

// Starting volume of each sound layer (0 – 1). Listeners can change these in the mixer.
export const MIX = {
  lake: 0.8,
  wind: 0.55,
  chimes: 0.6,
  creatures: 0.6,
  owl: 0.5,
  bell: 0.9,
  chant: 0.45,
  reverb: 0.35,
};

// Seconds between automatic temple bell strikes (random within this range).
export const BELL_INTERVAL = [55, 95];
