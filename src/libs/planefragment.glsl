precision mediump float;

uniform sampler2D u_tex;
uniform sampler2D u_prev;

in vec2 vUv;

float random(in vec2 _st) {
  return fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) *
    43758.5453123);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise(in vec2 _st) {
  vec2 i = floor(_st);
  vec2 f = fract(_st);

    // Four corners in 2D of a tile
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
    (c - a) * u.y * (1.0 - u.x) +
    (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 22

float fbm(in vec2 _st) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
  for(int i = 0; i < NUM_OCTAVES; ++i) {
    v += a * noise(_st);
    _st = rot * _st * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

vec3 blendMix(vec3 color1, vec3 color2) {
  return vec3(min(color1.r, color2.r), min(color1.g, color2.g), min(color1.b, color2.b));
}

vec3 blendMix2(vec3 color1, vec3 color2, float opacity) {
  return blendMix(color1, color2) * opacity + color2 * (1.0 - opacity);
}

void main() {
  vec4 tex = texture2D(u_tex, vUv);

  float disp = fbm(vUv * 22.0) * 0.0012;

  vec4 prev = texture2D(u_prev, vUv);
  vec4 prev2 = texture2D(u_prev, vec2(vUv.x + disp, vUv.y));
  vec4 prev3 = texture2D(u_prev, vec2(vUv.x - disp, vUv.y));
  vec4 prev4 = texture2D(u_prev, vec2(vUv.x, vUv.y + disp));
  vec4 prev5 = texture2D(u_prev, vec2(vUv.x, vUv.y - disp));

  vec3 floodColor = prev.rgb;
  floodColor = blendMix(floodColor, prev2.rgb);
  floodColor = blendMix(floodColor, prev3.rgb);
  floodColor = blendMix(floodColor, prev4.rgb);
  floodColor = blendMix(floodColor, prev5.rgb);

  vec3 waterColor = blendMix2(prev.rgb, floodColor * 1.02, 0.3);
  vec3 finalColor = prev.r == 0.0 ? tex.rgb : blendMix2(waterColor, tex.rgb, 0.995);
  gl_FragColor = vec4(finalColor, 1.0);
}