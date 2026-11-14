// ABOUTME: The pixel-art icons for the picture editor's tools, drawn the way the classic ones were.
// ABOUTME: Each is a 16 x 16 grid of letters, one per colour, drawn as crisp squares.
const COLORS: Record<string, string> = {
  k: "#000000",
  w: "#ffffff",
  g: "#808080",
  l: "#c0c0c0",
  r: "#ff0000",
  y: "#ffff00",
  Y: "#c0a000",
  b: "#0000ff",
  n: "#000080",
  c: "#00ffff",
  p: "#ff80a0",
  t: "#f0c878",
  G: "#00ff00",
};

const ICONS = {
  eraser: [
    "................",
    "..........kk....",
    ".........kppk...",
    "........kppppk..",
    ".......kpppppwk.",
    "......kpppppwwk.",
    ".....kpppppwwk..",
    "....kpppppwwk...",
    "...kpppppwwk....",
    "..kpppppwwk.....",
    ".kpppppwwk......",
    "kpppppwwk.......",
    "kppppwwk........",
    ".kppwwk.........",
    "..kwwk..........",
    "...kk...........",
  ],
  fill: [
    "................",
    "................",
    "................",
    ".....kkkkk......",
    "....k.....k.....",
    "....k.....k.....",
    "...kkkkkkkk.....",
    "..kwwwwwwwwk....",
    "..kwbbbbbbbkkkk.",
    "..kwbbbbbbbkbbbk",
    "..kwwwwwwwwkbbbk",
    "..kwwwwwwwwkbkbk",
    "..kwwwwwwwwkkbk.",
    "..kwwwwwwwwkbbbk",
    "...kkkkkkkk.kbk.",
    ".............k..",
  ],
  picker: [
    "............kggk",
    "...........kgggg",
    "..........kggggg",
    ".........kgggggk",
    ".........kggggk.",
    "........kwkggk..",
    ".......kwwwkk...",
    "......kwwwk.....",
    ".....kwwwk......",
    "....kwwwk.......",
    "...kwwwk........",
    "...kwwk.........",
    "...krk..........",
    "...kk...........",
    "................",
    "................",
  ],
  magnifier: [
    "................",
    "....kkkkk.......",
    "...kccccck......",
    "..kccccccck.....",
    ".kccwwccccck....",
    ".kccwcccccck....",
    ".kccccccccck....",
    ".kccccccccck....",
    ".kccccccccck....",
    "..kccccccckk....",
    "...kccccckYYk...",
    "....kkkkkkYYYk..",
    "..........kYYYk.",
    "...........kYYYk",
    "............kYYk",
    ".............kk.",
  ],
  pencil: [
    "............kppk",
    "..........kkpppk",
    ".........kykppk.",
    "........kyyykk..",
    ".......kyyyyyk..",
    "......kyyyyyk...",
    ".....kyyyyyk....",
    "....kyyyyyk.....",
    "...kyyyyyk......",
    "...kyyyyk.......",
    "...kyyyk........",
    "...kttk.........",
    "...kk...........",
    "................",
    "................",
    "................",
  ],
  brush: [
    "............kYYk",
    "...........kYYYk",
    "..........kYYYk.",
    "........kkYYYk..",
    ".......kwwkYk...",
    "......kkwwwk....",
    ".....kbbkwwk....",
    "....kbbbbkk.....",
    "...kbbbbbk......",
    "..kbbbbbk.......",
    ".kbbbbbk........",
    "kbbbbbk.........",
    "kbbbbk..........",
    ".kbbk...........",
    "..kk............",
    "................",
  ],
  airbrush: [
    "................",
    "......r.........",
    "...r............",
    ".....r...kkk....",
    "........kgggk...",
    "..r.....kgggk...",
    "....r...kgggk...",
    ".......kwkkkwk..",
    ".r.....kwwwwwk..",
    "...r...kwwwwwk..",
    ".......kwwwwwk..",
    ".......kwwwwwk..",
    ".......kwwwwwk..",
    ".......kwwwwwk..",
    "........kkkkk...",
    "................",
  ],
  line: [
    "................",
    "................",
    ".............k..",
    "............k...",
    "...........k....",
    "..........k.....",
    ".........k......",
    "........k.......",
    ".......k........",
    "......k.........",
    ".....k..........",
    "....k...........",
    "...k............",
    "..k.............",
    "................",
    "................",
  ],
  rectangle: [
    "................",
    "................",
    "................",
    "..kkkkkkkkkkkk..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
    "................",
  ],
  ellipse: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "...kk.....kkk...",
    "..kk........kk..",
    "..k..........k..",
    "..k..........k..",
    "..k..........kk.",
    "..k..........k..",
    "..kk........kk..",
    "...kkk....kkk...",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
  ],
  rounded: [
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "...k........k...",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "..k..........k..",
    "...k........k...",
    "....kkkkkkkk....",
    "................",
    "................",
    "................",
  ],
  palette: [
    "................",
    "................",
    ".....kkkkkk.....",
    "...kkttttttkk...",
    "..kttttttttttk..",
    ".kttttyytGGtttk.",
    ".kttttttttttttk.",
    ".kttrrtttttbbtk.",
    "kttttttttttttttk",
    ".ktttttttkkkttk.",
    ".kttttttkwwwktk.",
    ".kttttttkwwwktk.",
    "..kttttttkkktk..",
    "...kkttttttkk...",
    ".....kkkkkk.....",
    "................",
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

export default function PixelIcon({ name }: { name: PixelIconName }) {
  const rects: React.ReactNode[] = [];
  const grid = ICONS[name];
  for (let y = 0; y < grid.length; y++) {
    const row: string = grid[y];
    // Neighbouring squares of one colour are drawn as a single bar
    let x = 0;
    while (x < row.length) {
      const letter = row[x];
      let end = x;
      while (end + 1 < row.length && row[end + 1] === letter) end++;
      const color = COLORS[letter];
      if (color) {
        rects.push(
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={end - x + 1}
            height={1}
            fill={color}
          />,
        );
      }
      x = end + 1;
    }
  }

  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}