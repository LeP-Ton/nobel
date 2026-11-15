export interface SceneFraming {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

interface LaboratoryRenderer {
  resize(
    width: number,
    height: number,
    pixelRatio: number,
    framing: SceneFraming,
  ): void;
  render(seconds: number): void;
  dispose(): void;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_screen;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // 图像采样以左上角为原点，构图参数可以直接对应 CSS 的 object-position。
  v_screen = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
}
`;

function fragmentShader(precision: "highp" | "mediump") {
  return `
precision ${precision} float;
uniform sampler2D u_image;
uniform vec2 u_uvScale;
uniform vec2 u_uvOffset;
uniform vec4 u_phase;
uniform float u_strength;
uniform float u_imageAspect;
varying vec2 v_screen;

float cyanEnergy(vec3 color) {
  float chroma = smoothstep(0.025, 0.16, min(color.g, color.b) - color.r);
  float light = smoothstep(0.08, 0.42, max(color.g, color.b));
  return chroma * light;
}

float inwardPulse(float distance, float phase) {
  // 正向增加相位，会让等相位光带沿绝对距离减小的方向流向中央。
  float position = fract(distance * 3.8 + phase);
  float width = (position - 0.5) / 0.135;
  return exp(-width * width);
}

void main() {
  vec2 uv = v_screen * u_uvScale + u_uvOffset;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 original = texture2D(u_image, uv);
  if (u_strength <= 0.0) {
    gl_FragColor = original;
    return;
  }

  vec2 center = vec2(0.643, 0.452);
  vec2 delta = uv - center;
  vec2 local = delta / vec2(0.105, 0.18);
  float ellipse = 1.0 - smoothstep(0.84, 1.03, length(local));

  // 先按源图像素比例旋转采样，避免宽屏纹理中的晶格被挤压成椭圆。
  float angle = u_phase.y;
  float cosine = cos(angle);
  float sine = sin(angle);
  vec2 pixelOffset = vec2(delta.x * u_imageAspect, delta.y);
  vec2 rotatedOffset = mat2(cosine, -sine, sine, cosine) * pixelOffset;
  vec2 rotatedUv = center + vec2(rotatedOffset.x / u_imageAspect, rotatedOffset.y);
  vec3 rotated = original.rgb;
  float originalCrystal = cyanEnergy(original.rgb);
  float rotatedCrystal = 0.0;
  if (ellipse > 0.0) {
    rotated = texture2D(u_image, rotatedUv).rgb;
    rotatedCrystal = cyanEnergy(rotated);
  }

  // 原、新晶格的并集都参与替换，旧方向的亮线不会作为半透明残影留在底图上。
  // 只提取青绿结构，外围灰色金属环从始至终沿原UV采样。
  float featureUnion = smoothstep(0.045, 0.28, max(originalCrystal, rotatedCrystal));
  float replacement = ellipse * featureUnion;
  vec3 color = mix(original.rgb, rotated, replacement);

  float crystal = ellipse * rotatedCrystal;
  float breathing = 0.5 + 0.5 * sin(u_phase.x);
  vec3 crystalHue = mix(vec3(0.14, 0.56, 1.0), vec3(0.10, 1.0, 0.57), breathing);
  float crystalValue = max(rotated.r, max(rotated.g, rotated.b));
  float coreFlow = inwardPulse(length(local) * 0.7, u_phase.w);
  vec3 breathingColor = mix(rotated, crystalHue * crystalValue, 0.57);
  breathingColor *= mix(0.55, 1.60, breathing);
  breathingColor += crystalHue * (0.045 + 0.16 * breathing + 0.12 * coreFlow);
  color = mix(color, breathingColor, crystal * u_strength);

  // 源图横、竖光束独立遮罩：只照亮已有管道的青绿像素，不让脉冲横扫金属。
  float horizontalAxis = 1.0 - smoothstep(0.007, 0.024, abs(uv.y - 0.454));
  float horizontalExtent = smoothstep(0.423, 0.45, uv.x)
    * (1.0 - smoothstep(0.842, 0.869, uv.x));
  float verticalAxis = 1.0 - smoothstep(0.005, 0.015, abs(uv.x - 0.643));
  float verticalExtent = smoothstep(0.18, 0.207, uv.y)
    * (1.0 - smoothstep(0.676, 0.71, uv.y));
  float horizontalBeam = horizontalAxis * horizontalExtent;
  float verticalBeam = verticalAxis * verticalExtent;
  float beam = max(horizontalBeam, verticalBeam) * originalCrystal * (1.0 - ellipse * 0.9);
  float horizontalFlow = inwardPulse(abs(delta.x) / 0.25, u_phase.w);
  float verticalFlow = inwardPulse(abs(delta.y) / 0.28, u_phase.w + 0.23);
  float pulse = max(horizontalFlow * horizontalBeam, verticalFlow * verticalBeam);
  vec3 beamHue = mix(vec3(0.12, 0.64, 1.0), vec3(0.08, 1.0, 0.75), breathing * 0.7);
  // 明确的光束行进由外层SVG承担，这里补充管壁反射，避免两层高亮叠白。
  vec3 beamColor = original.rgb * (0.96 + 0.22 * pulse)
    + beamHue * (0.012 + 0.065 * pulse);
  color = mix(color, beamColor, clamp(beam * u_strength, 0.0, 1.0));

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), original.a);
}
`;
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function fraction(value: number) {
  return value - Math.floor(value);
}

export function createLaboratoryRenderer(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  strength: number,
): LaboratoryRenderer | null {
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  if (!image.complete || imageWidth <= 0 || imageHeight <= 0) return null;

  let gl: WebGLRenderingContext | null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }
  if (!gl || gl.isContextLost()) return null;
  const context = gl;
  let program: WebGLProgram | null = null;
  let vertex: WebGLShader | null = null;
  let fragment: WebGLShader | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let disposed = false;
  let unavailable = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    // 失败路径也共用释放逻辑，避免在开发模式的重复挂载中保留 GPU 资源。
    if (buffer) context.deleteBuffer(buffer);
    if (texture) context.deleteTexture(texture);
    if (program) context.deleteProgram(program);
    if (vertex) context.deleteShader(vertex);
    if (fragment) context.deleteShader(fragment);
    buffer = texture = program = vertex = fragment = null;
  }

  function compile(type: number, source: string) {
    const shader = context.createShader(type);
    if (!shader) throw new Error("无法分配科研场景着色器");
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      context.deleteShader(shader);
      throw new Error("科研场景着色器编译失败");
    }
    return shader;
  }

  function usable() {
    if (disposed || unavailable) return false;
    if (context.isContextLost()) unavailable = true;
    // 上下文恢复需要外层重新创建实例，不能继续使用旧的纹理与缓冲区句柄。
    return !unavailable;
  }

  try {
    const maximumTexture = context.getParameter(
      context.MAX_TEXTURE_SIZE,
    ) as number;
    if (imageWidth > maximumTexture || imageHeight > maximumTexture) {
      throw new Error("科研场景图像超出纹理尺寸限制");
    }
    const format = context.getShaderPrecisionFormat(
      context.FRAGMENT_SHADER,
      context.HIGH_FLOAT,
    );
    vertex = compile(context.VERTEX_SHADER, VERTEX_SHADER);
    fragment = compile(
      context.FRAGMENT_SHADER,
      fragmentShader(format && format.precision > 0 ? "highp" : "mediump"),
    );
    program = context.createProgram();
    if (!program) throw new Error("无法分配科研场景程序");
    context.attachShader(program, vertex);
    context.attachShader(program, fragment);
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      throw new Error("科研场景程序链接失败");
    }
    context.deleteShader(vertex);
    context.deleteShader(fragment);
    vertex = fragment = null;

    buffer = context.createBuffer();
    texture = context.createTexture();
    if (!buffer || !texture) throw new Error("无法分配科研场景图像资源");
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      context.STATIC_DRAW,
    );
    context.bindTexture(context.TEXTURE_2D, texture);
    // 不缩放或重采样源图；无 mipmap 的线性过滤也兼容非二次幂原始尺寸。
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MIN_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MAG_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_S,
      context.CLAMP_TO_EDGE,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_T,
      context.CLAMP_TO_EDGE,
    );
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA,
      context.RGBA,
      context.UNSIGNED_BYTE,
      image,
    );
    if (context.getError() !== context.NO_ERROR || context.isContextLost()) {
      throw new Error("科研场景纹理上传失败");
    }

    const position = context.getAttribLocation(program, "a_position");
    const imageUniform = context.getUniformLocation(program, "u_image");
    const scaleUniform = context.getUniformLocation(program, "u_uvScale");
    const offsetUniform = context.getUniformLocation(program, "u_uvOffset");
    const phaseUniform = context.getUniformLocation(program, "u_phase");
    const strengthUniform = context.getUniformLocation(program, "u_strength");
    const aspectUniform = context.getUniformLocation(program, "u_imageAspect");
    if (
      position < 0 ||
      !imageUniform ||
      !scaleUniform ||
      !offsetUniform ||
      !phaseUniform ||
      !strengthUniform ||
      !aspectUniform
    )
      throw new Error("科研场景着色器参数不可用");

    context.useProgram(program);
    context.uniform1i(imageUniform, 0);
    context.uniform1f(
      strengthUniform,
      Math.max(0, Math.min(1, finite(strength, 0))),
    );
    context.uniform1f(aspectUniform, imageWidth / imageHeight);
    context.disable(context.DEPTH_TEST);
    context.disable(context.CULL_FACE);
    context.disable(context.BLEND);
    const maximumViewport = context.getParameter(
      context.MAX_VIEWPORT_DIMS,
    ) as Int32Array;
    const maximumBuffer = context.getParameter(
      context.MAX_RENDERBUFFER_SIZE,
    ) as number;

    return {
      resize(width, height, pixelRatio, framing) {
        if (!usable()) return;
        const cssWidth = Math.max(1, finite(width, 1));
        const cssHeight = Math.max(1, finite(height, 1));
        const ratio = pixelRatio > 0 ? finite(pixelRatio, 1) : 1;
        const requestedWidth = cssWidth * ratio;
        const requestedHeight = cssHeight * ratio;
        // 4K与高像素比屏幕也按相同比例收缩，限制局部氛围效果的填充率和显存占用。
        const hardwareScale = Math.min(
          1,
          1920 / requestedWidth,
          1200 / requestedHeight,
          Math.min(maximumViewport[0], maximumBuffer) / requestedWidth,
          Math.min(maximumViewport[1], maximumBuffer) / requestedHeight,
        );
        const actualWidth = Math.max(
          1,
          Math.round(requestedWidth * hardwareScale),
        );
        const actualHeight = Math.max(
          1,
          Math.round(requestedHeight * hardwareScale),
        );
        if (canvas.width !== actualWidth) canvas.width = actualWidth;
        if (canvas.height !== actualHeight) canvas.height = actualHeight;
        context.viewport(0, 0, actualWidth, actualHeight);

        const cover = Math.max(cssWidth / imageWidth, cssHeight / imageHeight);
        const drawnWidth = imageWidth * cover;
        const drawnHeight = imageHeight * cover;
        const x = Math.max(0, Math.min(1, finite(framing?.x, 0.5)));
        const y = Math.max(0, Math.min(1, finite(framing?.y, 0.5)));
        const left = (cssWidth - drawnWidth) * x + finite(framing?.offsetX, 0);
        const top = (cssHeight - drawnHeight) * y + finite(framing?.offsetY, 0);
        context.useProgram(program);
        context.uniform2f(
          scaleUniform,
          cssWidth / drawnWidth,
          cssHeight / drawnHeight,
        );
        context.uniform2f(
          offsetUniform,
          -left / drawnWidth,
          -top / drawnHeight,
        );
      },
      render(seconds) {
        if (!usable()) return;
        const elapsed = finite(seconds, 0);
        const turn = Math.PI * 2;
        context.useProgram(program);
        context.bindBuffer(context.ARRAY_BUFFER, buffer);
        context.enableVertexAttribArray(position);
        context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, texture);
        // 在 CPU 上约束各自相位，长时间运行时仍能避免低精度 GPU 的计时抖动。
        context.uniform4f(
          phaseUniform,
          fraction(elapsed / 4) * turn,
          fraction(elapsed / 26) * turn,
          fraction(elapsed / 7) * turn,
          fraction(elapsed * 0.7),
        );
        context.drawArrays(context.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}
