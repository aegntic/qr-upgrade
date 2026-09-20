"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";

const MotionContext = createContext({
  playing: false,
  reduced: true,
  paused: false,
  toggle: () => {},
});
export const useSceneMotion = () => useContext(MotionContext);

export function MotionSystem({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    const visibility = () => setVisible(!document.hidden);
    sync();
    visibility();
    query.addEventListener("change", sync);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      query.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const playing = !reduced && !paused && visible;
  useEffect(() => {
    document.documentElement.dataset.motion = playing ? "running" : "paused";
    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, [playing]);
  return (
    <MotionContext.Provider
      value={{ playing, reduced, paused, toggle: () => setPaused((p) => !p) }}
    >
      <ObsidianAtmosphere playing={playing} />
      {children}
      <ExhibitionReveals playing={playing} />
    </MotionContext.Provider>
  );
}

export function MotionToggle() {
  const { playing, reduced, toggle } = useSceneMotion();
  return (
    <button
      className="motion-toggle"
      onClick={toggle}
      disabled={reduced}
      aria-label={
        reduced
          ? "Reduced motion is enabled"
          : playing
            ? "Pause animations"
            : "Resume animations"
      }
      title={reduced ? "Your device requests reduced motion" : undefined}
    >
      {playing ? <Pause size={13} /> : <Play size={13} />}
      <span>
        {reduced ? "Still mode" : playing ? "Motion on" : "Motion off"}
      </span>
    </button>
  );
}

const vertexSource = `attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}`;
const fragmentSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 uv=gl_FragCoord.xy/u_resolution;
 vec2 p=(uv-.5)*vec2(u_resolution.x/u_resolution.y,1.0);
 float t=u_time*.13;
 p+=vec2(u_pointer.x*.045,u_pointer.y*.025);
 float arc=length((p-vec2(.39,.02))*vec2(.65,1.05));
 float band=sin(arc*9.5-t+sin(p.y*3.0+t)*.5);
 float caustic=pow(max(0.0,band),18.0)*.065;
 float rim=exp(-abs(arc-.57-sin(t*.6)*.035)*65.0)*.105;
 float broad=exp(-length((p-vec2(.36,.18))*vec2(.8,1.2))*2.4)*.045;
 float grain=(noise(gl_FragCoord.xy)-.5)*.014;
 float brush=sin(gl_FragCoord.y*.8+noise(vec2(gl_FragCoord.x*.04,1.0)))*.002;
 float vignette=(1.0-smoothstep(.16,1.1,length(uv-.5)));
 vec3 light=vec3(.80,.86,.97)*(caustic+rim+broad)*vignette;
 gl_FragColor=vec4(vec3(.018,.023,.032)+light+grain+brush,1.0);
}`;

function ObsidianAtmosphere({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const time = useRef(0);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    const makeShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vertex = makeShader(gl.VERTEX_SHADER, vertexSource),
      fragment = makeShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "u_resolution"),
      clock = gl.getUniformLocation(program, "u_time"),
      pointer = gl.getUniformLocation(program, "u_pointer");
    let frame = 0,
      previous = 0,
      pointerX = 0,
      pointerY = 0;
    const render = () => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointer, pointerX, pointerY);
      gl.uniform1f(clock, time.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.renderer = "webgl";
    };
    const resize = () => {
      const scale = Math.min(1, 1600 / window.innerWidth);
      canvas.width = Math.round(window.innerWidth * scale);
      canvas.height = Math.round(window.innerHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
      render();
    };
    const tick = (now: number) => {
      if (!previous || now - previous >= 32) {
        time.current += previous ? Math.min((now - previous) / 1000, 0.1) : 0;
        previous = now;
        render();
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      pointerX = e.clientX / innerWidth - 0.5;
      pointerY = 0.5 - e.clientY / innerHeight;
    };
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      delete canvas.dataset.renderer;
    };
    const restored = () => setGeneration((v) => v + 1);
    resize();
    if (playing) {
      frame = requestAnimationFrame(tick);
      window.addEventListener("pointermove", move, { passive: true });
    }
    window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [playing, generation]);
  return (
    <div className="obsidian-atmosphere" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

function ExhibitionReveals({ playing }: { playing: boolean }) {
  const path = usePathname();
  useEffect(() => {
    if (!playing) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const animation = entry.target.animate(
              [
                { opacity: 0.6, transform: "translateY(22px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 700, easing: "cubic-bezier(.16,1,.3,1)" },
            );
            animations.push(animation);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [playing, path]);
  return null;
}
