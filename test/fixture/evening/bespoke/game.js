// An evening by the lamp: its one scene, the lamp as the play left it.
export default async function (bespoke) {
  await bespoke.show('lamp', { state: { lit: bespoke.saved.lit ?? true } });
}
