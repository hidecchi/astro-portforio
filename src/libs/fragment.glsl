precision mediump float;

uniform float u_tick;

in vec2 vUv;

void main() {
  vec3 color = vec3(.6 * (sin((u_tick) * .02) * 0.5 + 0.6), .1 * (tan((u_tick) * .02) * 0.5), .6 * (cos((u_tick) * .01) * 0.5 + 0.4));
  float dist = distance(vUv, vec2(0.25, 0.5));
  gl_FragColor = vec4(color, 0.9 - 4.0 * pow(dist, 2.0));
}