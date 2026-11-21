// ABOUTME: Draws TeX math as an SVG picture on the server, for the images people share from the site.
// ABOUTME: The site draws math with KaTeX in the browser; this uses MathJax with the same fonts, taught the KaTeX commands reviews use.
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import BaseMethods from "@mathjax/src/js/input/tex/base/BaseMethods.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import { Configuration } from "@mathjax/src/js/input/tex/Configuration.js";
import {
  ConfigurationType,
  HandlerType,
} from "@mathjax/src/js/input/tex/HandlerTypes.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js";
import ParseMethods from "@mathjax/src/js/input/tex/ParseMethods.js";
import type { ParseMethod } from "@mathjax/src/js/input/tex/Types.js";
import { TextMacrosMethods } from "@mathjax/src/js/input/tex/textmacros/TextMacrosMethods.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/js/svg.js";
import type { StackItem } from "@mathjax/src/js/input/tex/StackItem.js";
import {
  CommandMap,
  EnvironmentMap,
  MacroMap,
} from "@mathjax/src/js/input/tex/TokenMap.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

// KaTeX's logos, drawn upright, and its \raisebox, written with commands
// MathJax has
new MacroMap("katex-macros", {
  KaTeX: [
    BaseMethods.Macro,
    "\\mathrm{K\\kern-.17em\\raise{.21em}{\\scriptstyle A}\\kern-.15em\\TeX}",
  ],
  LaTeX: [
    BaseMethods.Macro,
    "\\mathrm{L\\kern-.36em\\raise{.21em}{\\scriptstyle A}\\kern-.15em\\TeX}",
  ],
  TeX: [
    BaseMethods.Macro,
    "\\mathrm{T\\kern-.1667em\\lower{.5ex}{E}\\kern-.125em X}",
  ],
  raisebox: [BaseMethods.Macro, "\\raise{#1}{\\hbox{#2}}", 2],
});

// An array's rows are spaced by \arraystretch (1 unless it's defined), as
// KaTeX does: its rows are 1.2em apart times the stretch, or as tall as what's
// in them. With a tiny stretch, rows touch, which reviews use to draw
// pictures out of \rule.
const stretchedArray: ParseMethod = (parser, begin, style?: string) => {
  const array = BaseMethods.AlignedArray(parser, begin, style) as StackItem & {
    arraydef: Record<string, unknown>;
  };
  // KaTeX pads an array's sides, but not its top and bottom
  array.setProperty("arrayPadding", ".5em 0");
  const defined = parser.lookup(HandlerType.MACRO, "arraystretch");
  const stretch = defined ? Number(defined.args?.[0]) : 1;
  if (Number.isFinite(stretch) && stretch >= 0) {
    // MathJax gives every row at least 1em, which KaTeX's rows reach at a
    // stretch of about 0.84
    array.arraydef.useHeight = stretch >= 0.84;
    array.arraydef.rowspacing = `${Math.max(0, 1.2 * stretch - 1).toFixed(3)}em`;
  }
  return array;
};

new EnvironmentMap(
  "katex-environments",
  ParseMethods.environment as ParseMethod,
  {
    array: [stretchedArray],
    darray: [stretchedArray, "D"],
  },
);

const KaTeXConfiguration = Configuration.create("katex", {
  [ConfigurationType.HANDLER]: {
    [HandlerType.MACRO]: ["katex-macros"],
    [HandlerType.ENVIRONMENT]: ["katex-environments"],
  },
  [ConfigurationType.PRIORITY]: 1,
});

// KaTeX lets \text and \textcolor be used inside text, like a box's words
new CommandMap("katex-text-macros", {
  text: [TextMacrosMethods.Macro, "{#1}", 1],
  textcolor: [TextMacrosMethods.Macro, "\\(\\textcolor{#1}{\\text{#2}}\\)", 2],
});

const KaTeXTextConfiguration = Configuration.create("katex-text", {
  [ConfigurationType.PARSER]: "text",
  [ConfigurationType.HANDLER]: {
    [HandlerType.MACRO]: ["katex-text-macros"],
  },
  [ConfigurationType.PRIORITY]: 1,
});

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// A new page of math for each drawing, since a \def lasts for the whole page
// and one review's commands mustn't change another's math
function mathPage() {
  const tex = new TeX({
    packages: [
      "base",
      "ams",
      "newcommand",
      "color",
      "mathtools",
      "textmacros",
      "noundefined",
      KaTeXConfiguration.name,
    ],
    textmacros: { packages: ["text-base", KaTeXTextConfiguration.name] },
    // Like KaTeX's maxExpand, so a macro that calls itself stops
    maxMacros: 1000,
    formatError: (_jax: unknown, error: Error) => {
      throw error;
    },
  });
  const svg = new SVG({
    fontData: MathJaxTexFont,
    fontCache: "local",
    // Math in a line of text stays in one piece, as KaTeX keeps it
    linebreaks: { inline: false },
  });
  return mathjax.document("", { InputJax: tex, OutputJax: svg });
}

export type TeXPicture = {
  // The picture as a data address
  src: string;
  // Its size in pixels, and how far it reaches below the line the text
  // around it sits on
  width: number;
  height: number;
  depth: number;
};

// The TeX drawn as an SVG, on its own line when `display`, in `color`, at a
// font size of `em` pixels. Math wider than `maxWidth` is shrunk to fit, and
// math taller than `maxHeight` is cut off at the bottom. Null when it doesn't
// parse, since KaTeX then shows it as written.
export function texPicture(
  source: string,
  {
    display,
    color,
    em,
    maxWidth,
    maxHeight,
  }: {
    display: boolean;
    color: string;
    em: number;
    maxWidth: number;
    maxHeight: number;
  },
): TeXPicture | null {
  let node: unknown;
  try {
    node = mathPage().convert(source, { display });
  } catch {
    return null;
  }
  const root = adaptor.firstChild(node as never) as never;
  // In thousandths of an em
  const [left, top, wide, tall] = String(adaptor.getAttribute(root, "viewBox"))
    .split(" ")
    .map(Number);
  if (![left, top, wide, tall].every(Number.isFinite) || wide <= 0) {
    return null;
  }
  const scale = Math.min(em / 1000, maxWidth / wide);
  const shown = Math.min(tall, maxHeight / scale);
  const [width, height] = [wide * scale, shown * scale];
  // The renderer fails on a picture with no area
  if (width < 1 || height < 1) return null;
  adaptor.removeAttribute(root, "style");
  adaptor.setAttribute(root, "color", color);
  adaptor.setAttribute(root, "width", String(width));
  adaptor.setAttribute(root, "height", String(height));
  adaptor.setAttribute(root, "viewBox", `${left} ${top} ${wide} ${shown}`);
  const svg = adaptor
    .serializeXML(root)
    // The TeX each part came from, which only adds weight
    .replace(/ data-[a-z-]+="[^"]*"/g, "")
    // Boxes and rules have sharp edges, so ones side by side show no seam
    .replaceAll("<rect ", '<rect shape-rendering="crispEdges" ');
  return {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    width,
    height,
    depth: (top + shown) * scale,
  };
}
