import { Vector2 } from 'three';

/**
 * Filter the REAL directional shadow map with a widening area-light footprint.
 * Close to the graphite the contact stays sharp; the raised barrel casts softer
 * shadows farther along the paper. No bitmap or independently animated shadow.
 * Scoped to this material, leaving Three's shared shader chunks untouched.
 */
export function softenPaperShadow(material) {
  const uniforms = {
    paperTip: { value: new Vector2() },
    paperShadowSpan: { value: 4200 },
    paperShadowDirection: { value: new Vector2(0.976, -0.217) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec2 vPaperPosition;\n${shader.vertexShader}`.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvPaperPosition = (modelMatrix * vec4(transformed, 1.0)).xy;',
    );
    shader.fragmentShader = `
      varying vec2 vPaperPosition;
      uniform vec2 paperTip;
      uniform float paperShadowSpan;
      uniform vec2 paperShadowDirection;
    ${shader.fragmentShader}`.replace('#include <shadowmask_pars_fragment>', `
      #include <shadowmask_pars_fragment>
      float softPaperShadow() {
        #if NUM_DIR_LIGHT_SHADOWS > 0
          vec2 delta = vPaperPosition - paperTip;
          float along = dot(delta, paperShadowDirection);
          float across = abs(dot(delta, vec2(-paperShadowDirection.y, paperShadowDirection.x)));
          if (along < -35.0 || across > 160.0) return 1.0;
          float distanceToTip = length(delta);
          float radius = clamp(distanceToTip * 0.09 + 0.4, 0.4, 66.0) / paperShadowSpan;
          float rotation = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
          float result = 0.0;
          DirectionalLightShadow light = directionalLightShadows[0];
          #pragma unroll_loop_start
          for (int i = 0; i < 32; i++) {
            {
            float angle = float(UNROLLED_LOOP_INDEX) * 2.39996323 + rotation;
            float ring = sqrt((float(UNROLLED_LOOP_INDEX) + 0.5) / 32.0);
            vec4 coord = vDirectionalShadowCoord[0];
            coord.xy += vec2(cos(angle), sin(angle)) * ring * radius * coord.w;
            result += getShadow(
              directionalShadowMap[0], light.shadowMapSize,
              light.shadowIntensity, light.shadowBias,
              light.shadowRadius, coord
            );
            }
          }
          #pragma unroll_loop_end
          return result / 32.0;
        #else
          return 1.0;
        #endif
      }
    `).replace('1.0 - getShadowMask()', '1.0 - softPaperShadow()');
  };
  material.customProgramCacheKey = () => 'shakespread-soft-paper-shadow-v1';
  return uniforms;
}
