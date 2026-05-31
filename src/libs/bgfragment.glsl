precision mediump float;

uniform float u_brightness;
uniform float u_tick;
uniform float u_bg_adjust;
in vec2 vUv;


vec3 cyclic(vec3 p) {
    vec4 sum = vec4(0);

    for(int i = 0; i < 8; i++) {
        p += sin(p.yzx);
        sum += 2.0f * sum + vec4(cross(cos(p), sin(p.zxy)), 1);
        p *= 2.0f;
    }

    return sum.xyz / sum.w;
}

void main() {
  // gl_FragColor = vec4(cyclic(vec3(vUv.x * 6.0f, vUv.y * 5.0f, u_tick * 0.05f)) * 0.3f + vec3(-0.0f, 0.7f, 0.8f), 0.8f);
  // gl_FragColor = vec4(gl_FragColor.x, gl_FragColor.x , gl_FragColor.x, 1.0f);

    gl_FragColor = vec4(cyclic(vec3(vUv.x * u_bg_adjust, vUv.y * 5.0f, u_tick * 0.01f)) * 0.3f + vec3(-0.0f, 0.7f, 0.8f), 0.8f);
    // fragColor = buffer;
    gl_FragColor = vec4(0.2, 0.5-gl_FragColor.x , 0.6-gl_FragColor.x, 1.0f);
}
