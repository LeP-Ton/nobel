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
varying vec2 v_screen;

void main() {
  vec2 uv = v_screen * u_uvScale + u_uvOffset;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 original = texture2D(u_image, uv);
  // 椭圆只覆盖原图中的中央晶格，不让外层金属环参与折射或发光。
  vec2 local = (uv - vec2(0.643, 0.452)) / vec2(0.105, 0.18);
  float ellipse = 1.0 - smoothstep(0.64, 1.0, length(local));
  float cyan = smoothstep(0.045, 0.20, min(original.g, original.b) - original.r);
  float luminance = max(original.g, original.b);
  float crystal = ellipse * cyan * smoothstep(0.16, 0.48, luminance);
  if (crystal <= 0.0 || u_strength <= 0.0) {
    gl_FragColor = original;
    return;
  }
  float influence = crystal * u_strength;

  // 仅做不足一个原图像素量级的折射，保留晶格细节及背景的稳定性。
  vec2 ripple = vec2(
    sin(local.y * 17.0 + local.x * 3.0 - u_phase.y),
    cos(local.x * 19.0 - local.y * 4.0 + u_phase.z)
  );
  vec2 distortedUv = uv + ripple * vec2(0.00048, 0.00064) * influence;
  vec3 refracted = texture2D(u_image, distortedUv).rgb;
  vec3 color = mix(original.rgb, refracted, influence);

  float breathing = 0.5 + 0.5 * sin(u_phase.x);
  float flowPosition = fract(local.y * 0.31 + local.x * 0.13 - u_phase.w);
  float ribbon = exp(-pow((flowPosition - 0.5) / 0.075, 2.0));
  float brightLattice = smoothstep(0.32, 0.86, luminance);
  float flow = ribbon * (0.25 + 0.75 * brightLattice);
  // 光流沿已有青绿晶格掠过；低幅度慢呼吸避免变成闪烁的独立光斑。
  float glow = (0.009 + breathing * 0.018 + flow * 0.045) * influence;
  color += vec3(0.12, 0.78, 0.69) * glow;
  color += original.rgb * (breathing * 0.012 + flow * 0.022) * influence;
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
    if (
      position < 0 ||
      !imageUniform ||
      !scaleUniform ||
      !offsetUniform ||
      !phaseUniform ||
      !strengthUniform
    )
      throw new Error("科研场景着色器参数不可用");

    context.useProgram(program);
    context.uniform1i(imageUniform, 0);
    context.uniform1f(
      strengthUniform,
      Math.max(0, Math.min(1, finite(strength, 0))),
    );
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
          fraction((elapsed * 0.58) / turn) * turn,
          fraction((elapsed * 0.37) / turn) * turn,
          fraction((elapsed * 0.29) / turn) * turn,
          fraction(elapsed * 0.065),
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
