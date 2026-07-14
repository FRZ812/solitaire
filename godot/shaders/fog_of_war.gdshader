shader_type canvas_item;

uniform bool fog_enabled = true;
uniform int reveal_count = 0;
uniform vec2 reveal_centers[128];
uniform vec2 reveal_radii[128];
uniform vec4 fog_color : source_color = vec4(0.015, 0.045, 0.095, 1.0);
uniform float fog_strength : hint_range(0.0, 1.0) = 0.94;

float fog_noise(vec2 point) {
	vec2 cell = floor(point * vec2(64.0, 38.0));
	return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	if (!fog_enabled) {
		COLOR = vec4(0.0);
	} else {
		float reveal = 0.0;
		for (int i = 0; i < 128; i++) {
			if (i >= reveal_count) {
				break;
			}
			vec2 radius = max(reveal_radii[i], vec2(0.0001));
			float distance_from_cell = length((UV - reveal_centers[i]) / radius);
			float cell_reveal = 1.0 - smoothstep(0.68, 1.16, distance_from_cell);
			reveal = max(reveal, cell_reveal);
		}

		float cloud = (fog_noise(UV + vec2(TIME * 0.006, 0.0)) - 0.5) * 0.075;
		float vignette = smoothstep(0.34, 0.78, distance(UV, vec2(0.5))) * 0.08;
		float alpha = clamp((1.0 - reveal) * fog_strength + cloud * (1.0 - reveal) + vignette, 0.0, 0.97);
		vec3 blue_lift = vec3(0.018, 0.045, 0.08) * max(0.0, cloud + 0.03);
		COLOR = vec4(fog_color.rgb + blue_lift, alpha);
	}
}
