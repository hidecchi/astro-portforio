precision mediump float;

uniform sampler2D u_tex;

in vec2 vUv;

void main() {
  vec4 tex = texture2D(u_tex, vUv);
  gl_FragColor = vec4(tex.xyz, 1.0);
  // gl_FragColor = vec4(mix(tex.xyz, vec3(0.0), 0.5), 1.0);
  // gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}