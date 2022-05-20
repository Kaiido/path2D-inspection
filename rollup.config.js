// rollup.config.js
import { terser } from "rollup-plugin-terser";

export default {
  input: "./source/path2D-inspection.mjs",
  output: [
    {
      file: "./build/path2D-inspection.js",
      format: "iife"
    },
    {
      file: "./build/path2D-inspection.min.js",
      format: "iife",
      plugins: [ terser() ]
    }
  ]
};
