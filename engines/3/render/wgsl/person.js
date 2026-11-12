// The mains round PEOPLE's texts (PP9): PEOPLE gives each kind's vertex text (personVertex — the root's space,
// skinned; personFacing — the point's carry, given the root) and surface text (personSurface) and declares its own
// groups; RENDER declares PersonPoint and Surface, takes the point into the world (the person's row of the nodes),
// lights it as everything is lit and writes the colour and the person's id. RENDER names no field of PEOPLE's
// structs: what crosses the stages of theirs is the carry, whose members PEOPLE lists as data (PERSON_CARRY) — a
// stage's output holds no structure inside it.
//   main  — in the main passes and, its winding turned, in a mirror's (the same text: its colour's alpha is how much
//           of the person there is — 1, but in a mirror that fades with height: 5.7 —, which a mirror's image keeps).
//           Lit at its vertices (every light, every shadow, the land's among them: people take them all), hazed
//           there; the normal as it is — no turn toward the eye: a one-sided kind's back faces are culled; a
//           two-sided kind (cloth) is lit for both its sides at the vertex, and the fragment takes the side
//           `front_facing` names. A silhouette's ink gives way to its colours as the light on it grows (main's
//           formula, kept); a faceted figure's faces take the flat pair of its light. Writes the colour and, in
//           `ids`, (its slot, the part, its lines' width and kind): the canvas pass draws the people's lines from them.
//   depth — a light's view: its place, nothing else.
// options: { carry: PERSON_CARRY, pass: 'main' | 'depth', twoSided }.
import { chunk } from '../../gpu/wgsl.js';

const member = (m, body) => `@location(${m.location})${m.flat ? ' @interpolate(flat)' : ''} ${m.name}: ${m.type}${body}`;

chunk('render.person', ({ carry, pass, twoSided }) => /* wgsl */ `
struct PersonPoint { position: vec3f, normal: vec3f, carry: PersonCarry }
struct Surface { albedo: vec3f, emissive: vec3f, ink: vec3f, rim: f32, facet: f32, part: u32 }
struct e_PersonOut {
  @builtin(position) position: vec4f,
  @location(0) light: vec3f,
  @location(1) around: vec3f,
  @location(2) @interpolate(flat) lightFlat: vec3f,
  @location(3) @interpolate(flat) aroundFlat: vec3f,
  @location(4) air: vec4f,
  @location(7) there: f32,
${twoSided ? /* wgsl */ `  @location(5) lightBack: vec3f,
  @location(6) @interpolate(flat) lightBackFlat: vec3f,
` : ''}${carry.map(m => `  ${member(m, ',')}`).join('\n')}
}
@vertex fn e_vertex(v: PersonIn) -> e_PersonOut {
  let p = personVertex(v);
  let n = e_nodes[personNode()];
  let c = personFacing(p, n.r0, n.r1, n.r2);
  let l = vec4f(p.position, 1.0);
  let P = vec3f(dot(n.r0, l), dot(n.r1, l), dot(n.r2, l));
  var o: e_PersonOut;
  o.position = e_clip(P);
${carry.map(m => `  o.${m.name} = c.${m.name};`).join('\n')}
${pass === 'main' ? /* wgsl */ `
  let N = normalize(vec3f(dot(n.r0.xyz, p.normal), dot(n.r1.xyz, p.normal), dot(n.r2.xyz, p.normal)));
  let L = e_lightOn(P, N, 1.0, personInside(), 0xffffffffu, false, 1.0, 0.0);
  // (the highlight's breath)
  let k = personGlow();
  // (in a mirror that fades with height: how much of them is there)
  o.there = 1.0;
  if ((e_view.flags & e_VIEW_MIRROR) != 0u && e_view.e_fade.x > 0.0) { o.there = 1.0 - smoothstep(0.0, e_view.e_fade.x, dot(e_view.e_mirror.xyz, P) + e_view.e_mirror.w); }
  o.light = L.base * k;
  o.around = L.around * k;
  o.lightFlat = o.light;
  o.aroundFlat = o.around;
${twoSided ? /* wgsl */ `  // (its other side: the same place, turned the other way — the light all round is the same)
  o.lightBack = e_lightOn(P, -N, 1.0, personInside(), 0xffffffffu, false, 1.0, 0.0).base * k;
  o.lightBackFlat = o.lightBack;
` : ''}  o.air = e_airAt(P);
` : ''}  return o;
}
${pass === 'main' ? /* wgsl */ `
struct e_Solid { @location(0) colour: vec4f, @location(1) ids: vec4u }
@fragment fn e_fragment(in: e_PersonOut${twoSided ? ', @builtin(front_facing) front: bool' : ''}) -> e_Solid {
  let s = personSurface(PersonCarry(${carry.map(m => `in.${m.name}`).join(', ')}));
  var L = in.light;
  var A = in.around;
  if (s.facet > 0.5) { L = in.lightFlat; A = in.aroundFlat; }
${twoSided ? /* wgsl */ `  if (!front) {
    L = in.lightBack;
    if (s.facet > 0.5) { L = in.lightBackFlat; }
  }
` : ''}  let a = mix(s.ink, s.albedo, smoothstep(0.12, 0.42, pow(luma(L), 1.0 / 2.2)));
  let c = a * L + s.rim * max(L - A, vec3f(0.0)) + s.emissive;
  let lines = personLines();
  var o: e_Solid;
  o.colour = vec4f(e_dithered(c * (1.0 - in.air.a) + in.air.rgb, in.position.xy) * in.there, in.there);
  o.ids = vec4u(personSlot(), s.part, lines.x, lines.y);
  return o;
}
` : ''}
`);
