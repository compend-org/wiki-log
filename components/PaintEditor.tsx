// ABOUTME: A small paint program in a classic desktop window, for drawing a compound's 100 x 100 picture.
// ABOUTME: Left button draws in the foreground colour, right button in the background colour.
"use client";

import "./PaintEditor.css";
import {
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import PixelIcon, { type PixelIconName } from "@/components/icons/PaintIcons";
import {
    type Bitmap,
    BLACK,
    type BrushShape,
    blankBitmap,
    brushOffsets,
    drawShape,
    type FillStyle,
    fillAll,
    flipHorizontal,
    flipVertical,
    floodFill,
    getPixel,
    invertColors,
    PAINT_SIZE,
    PALETTE,
    penOffsets,
    type Rgb,
    rgbCss,
    rgbHex,
    rotate,
    type ShapeKind,
    sameBitmap,
    spray,
    strokeLine,
    WHITE,
} from "@/lib/paint";
import {
    copyRegion,
    fillRegion,
    pasteRegion,
    type Region,
    regionBetween,
} from "@/lib/paintSelection";

const TOOLS = [
    [
        "select",
        "Select",
        "Selects a rectangular part of the picture to move, copy, or edit.",
    ],
    [
        "eraser",
        "Eraser/Color Eraser",
        "Erases a portion of the picture, using the selected eraser shape.",
    ],
    ["fill", "Fill With Color", "Fills an area with the current drawing color."],
    ["picker", "Pick Color", "Picks up a color from the picture for drawing."],
    ["magnifier", "Magnifier", "Changes the magnification."],
    ["pencil", "Pencil", "Draws a free-form line one pixel wide."],
    ["brush", "Brush", "Draws using a brush with the selected shape and size."],
    ["airbrush", "Airbrush", "Draws using an airbrush of the selected size."],
    ["line", "Line", "Draws a straight line with the selected line width."],
    ["rectangle", "Rectangle", "Draws a rectangle with the selected fill style."],
    ["ellipse", "Ellipse", "Draws an ellipse with the selected fill style."],
    [
        "rounded",
        "Rounded Rectangle",
        "Draws a rounded rectangle with the selected fill style.",
    ],
] as const satisfies readonly (readonly [
    PixelIconName | "select",
    string,
    string,
])[];

type Tool = (typeof TOOLS)[number][0];

const ZOOMS = [1, 2, 4, 6, 8];
const ERASER_SIZES = [2, 4, 6, 8];
const BRUSH_SHAPES: BrushShape[] = ["circle", "square", "slash", "backslash"];
const BRUSH_SIZES = [6, 4, 2];
const AIRBRUSH_SIZES = [4, 8, 12];
const LINE_WIDTHS = [1, 2, 3, 4, 5];
const FILL_STYLES: FillStyle[] = ["outline", "both", "fill"];
const UNDO_LIMIT = 100;

// How far the pointer has got with a stroke or shape it is in the middle of
type Drag = {
    tool: Tool;
    pointerId: number;
    // The colour being drawn with, and the other one
    color: Rgb;
    other: Rgb;
    start: { x: number; y: number };
    last: { x: number; y: number };
    // The picture as it was before this started
    before: Bitmap;
    // For lines and shapes: the picture they are drawn over
    base: Bitmap | null;
    timer: number | null;
};

// A rectangle of the picture being moved about. Until it is first dragged it
// is only outlined; then its pixels are lifted off the picture, leaving the
// background colour behind, and laid down again wherever it is dropped.
type Selection = Region & {
    pixels: Bitmap | null;
    // The picture without the lifted pixels
    base: Bitmap | null;
    // The picture as it was before they were lifted
    before: Bitmap | null;
};

type SelectDrag = {
    pointerId: number;
    kind: "marquee" | "move";
    start: { x: number; y: number };
    // Where the selection was when a move started
    origin: { x: number; y: number };
};

type MenuItem =
    | "rule"
    | { label: string; keys?: string; run: () => void; disabled?: boolean };

function startingZoom(): number {
    // The window, its toolbox and some margin take up the rest of the width
    const room = window.innerWidth - 16 - 56 - 40;
    return Math.max(1, Math.min(4, Math.floor(room / PAINT_SIZE)));
}

function Option({
    pressed,
    label,
    onClick,
    children,
}: {
    pressed: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={onClick}
            className="paint-option"
        >
            {children}
        </button>
    );
}

// What a brush leaves behind, drawn at actual size
function BrushSample({ shape, size }: { shape: BrushShape; size: number }) {
    const half = Math.floor(size / 2);
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            {brushOffsets(shape, size).map(([dx, dy]) => (
                <rect
                    key={`${dx},${dy}`}
                    x={dx + half}
                    y={dy + half}
                    width={1}
                    height={1}
                    fill="currentColor"
                />
            ))}
        </svg>
    );
}

const SPRAY_DOTS = [
    [0, 0],
    [0.5, 0.1],
    [-0.4, 0.3],
    [0.2, -0.6],
    [-0.7, -0.2],
    [0.8, 0.5],
    [-0.3, 0.8],
    [0.1, 0.9],
    [-0.8, 0.4],
    [0.6, -0.7],
    [-0.2, -0.3],
    [0.9, -0.1],
    [-0.6, -0.8],
    [0.3, 0.4],
] as const;

function SpraySample({ size }: { size: number }) {
    const radius = size / 2 + 1;
    const box = Math.ceil(radius * 2) + 1;
    return (
        <svg
            width={box}
            height={box}
            viewBox={`0 0 ${box} ${box}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            {SPRAY_DOTS.map(([dx, dy]) => (
                <rect
                    key={`${dx},${dy}`}
                    x={Math.round(box / 2 + dx * radius)}
                    y={Math.round(box / 2 + dy * radius)}
                    width={1}
                    height={1}
                    fill="currentColor"
                />
            ))}
        </svg>
    );
}

function FillSample({ style }: { style: FillStyle }) {
    return (
        <svg
            width={36}
            height={11}
            viewBox="0 0 36 11"
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            <rect
                x={0.5}
                y={0.5}
                width={35}
                height={10}
                fill={
                    style === "outline"
                        ? "none"
                        : style === "both"
                            ? "#808080"
                            : "currentColor"
                }
                stroke={style === "fill" ? "none" : "currentColor"}
            />
        </svg>
    );
}

// The select tool's icon: a dotted rectangle
function SelectIcon() {
    return (
        <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            <rect
                x={2.5}
                y={3.5}
                width={11}
                height={9}
                fill="none"
                stroke="#000000"
                strokeDasharray="1 1"
            />
        </svg>
    );
}

// What the two select settings do: a picture with its background colour kept
// (opaque) or left out (transparent) over a pattern
function SelectSample({ transparent }: { transparent: boolean }) {
    return (
        <svg
            width={36}
            height={18}
            viewBox="0 0 36 18"
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            <rect x={0} y={0} width={36} height={18} fill="#808080" />
            <rect
                x={4.5}
                y={2.5}
                width={27}
                height={13}
                fill={transparent ? "none" : "#ffffff"}
                stroke="currentColor"
                strokeDasharray="1 1"
            />
            <rect x={10} y={6} width={9} height={6} fill="#ff0000" />
            <rect x={20} y={8} width={6} height={4} fill="#0000ff" />
        </svg>
    );
}

export default function PaintEditor({
    initial,
    onSave,
    onCancel,
}: {
    // The picture to carry on drawing, as a PNG data address
    initial: string | null;
    onSave: (png: string) => void;
    onCancel: () => void;
}) {
    const root = useRef<HTMLDivElement>(null);
    const menubar = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const colorInput = useRef<HTMLInputElement>(null);
    const bitmap = useRef<Bitmap>(blankBitmap());
    const undoStack = useRef<Bitmap[]>([]);
    const redoStack = useRef<Bitmap[]>([]);
    const drag = useRef<Drag | null>(null);
    const selection = useRef<Selection | null>(null);
    const selectDrag = useRef<SelectDrag | null>(null);
    // What was last cut or copied
    const clipboard = useRef<{ pixels: Bitmap; w: number; h: number } | null>(
        null,
    );
    const previousTool = useRef<Tool>("pencil");
    // Counts changes to the undo history, so the menus re-render with it
    const [, setHistoryVersion] = useState<number>(0);

    const [tool, setTool] = useState<Tool>("pencil");
    const [foreground, setForeground] = useState<Rgb>(BLACK);
    const [background, setBackground] = useState<Rgb>(WHITE);
    const [zoom, setZoom] = useState<number>(startingZoom);
    const [eraserSize, setEraserSize] = useState<number>(4);
    const [brush, setBrush] = useState<{ shape: BrushShape; size: number }>({
        shape: "circle",
        size: 4,
    });
    const [airbrushSize, setAirbrushSize] = useState<number>(8);
    const [lineWidth, setLineWidth] = useState<number>(1);
    const [fillStyle, setFillStyle] = useState<FillStyle>("outline");
    const [position, setPosition] = useState<{ x: number; y: number } | null>(
        null,
    );
    const [menu, setMenu] = useState<string | null>(null);
    const [about, setAbout] = useState<boolean>(false);
    const [hoverHelp, setHoverHelp] = useState<string>("");
    // Where the selection is, for drawing its outline
    const [selectionBox, setSelectionBox] = useState<Region | null>(null);
    // Whether the background colour of a selection lets what is under it show
    const [selectTransparent, setSelectTransparent] = useState<boolean>(false);

    const show = useCallback(() => {
        const ctx = canvas.current?.getContext("2d");
        if (!ctx) return;
        ctx.putImageData(
            new ImageData(bitmap.current, PAINT_SIZE, PAINT_SIZE),
            0,
            0,
        );
    }, []);

    // Draws what's there to begin with, and loads the earlier drawing if any
    useEffect(() => {
        show();
        root.current?.focus();
        if (!initial) return;
        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (cancelled) return;
            const scratch = document.createElement("canvas");
            scratch.width = PAINT_SIZE;
            scratch.height = PAINT_SIZE;
            const ctx = scratch.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(image, 0, 0, PAINT_SIZE, PAINT_SIZE);
            bitmap.current.set(ctx.getImageData(0, 0, PAINT_SIZE, PAINT_SIZE).data);
            show();
        };
        image.src = initial;
        return () => {
            cancelled = true;
        };
    }, [initial, show]);

    // Stops an airbrush that is still spraying if the window goes away
    useEffect(
        () => () => {
            if (drag.current?.timer) window.clearInterval(drag.current.timer);
        },
        [],
    );

    // A click anywhere but the menus closes an open menu
    useEffect(() => {
        if (menu === null) return;
        const close = (e: PointerEvent) => {
            if (!menubar.current?.contains(e.target as Node)) setMenu(null);
        };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, [menu]);

    function commit(before: Bitmap) {
        if (sameBitmap(before, bitmap.current)) return;
        undoStack.current.push(before);
        if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
        redoStack.current = [];
        setHistoryVersion((v) => v + 1);
    }

    // Applies a change to the whole picture, as one step that can be undone
    function change(edit: (b: Bitmap) => void) {
        finishSelection();
        const before = bitmap.current.slice();
        edit(bitmap.current);
        commit(before);
        show();
    }

    function undo() {
        finishSelection();
        const previous = undoStack.current.pop();
        if (!previous) return;
        redoStack.current.push(bitmap.current.slice());
        bitmap.current.set(previous);
        show();
        setHistoryVersion((v) => v + 1);
    }

    function redo() {
        finishSelection();
        const next = redoStack.current.pop();
        if (!next) return;
        undoStack.current.push(bitmap.current.slice());
        bitmap.current.set(next);
        show();
        setHistoryVersion((v) => v + 1);
    }

    function save() {
        finishSelection();
        if (canvas.current) onSave(canvas.current.toDataURL("image/png"));
    }

    // Selections

    function showSelectionBox() {
        const s = selection.current;
        setSelectionBox(s ? { x: s.x, y: s.y, w: s.w, h: s.h } : null);
    }

    // Draws the lifted pixels over the picture where they now are
    function layDownSelection(transparent = selectTransparent) {
        const s = selection.current;
        if (!s?.pixels || !s.base) return;
        bitmap.current.set(s.base);
        pasteRegion(
            bitmap.current,
            s.pixels,
            s,
            s,
            transparent ? background : null,
        );
        show();
    }

    // Lifts the selected pixels off the picture, ready to be moved
    function liftSelection() {
        const s = selection.current;
        if (!s || s.pixels) return;
        s.before = bitmap.current.slice();
        s.pixels = copyRegion(bitmap.current, s);
        s.base = bitmap.current.slice();
        fillRegion(s.base, s, background);
        layDownSelection();
    }

    // Drops the selection where it is, as one step that can be undone
    function finishSelection() {
        const s = selection.current;
        if (!s) return;
        selection.current = null;
        selectDrag.current = null;
        setSelectionBox(null);
        if (s.pixels && s.before) commit(s.before);
    }

    function selectRegion(region: Region) {
        selection.current = { ...region, pixels: null, base: null, before: null };
        showSelectionBox();
    }

    function selectAll() {
        finishSelection();
        setTool("select");
        selectRegion({ x: 0, y: 0, w: PAINT_SIZE, h: PAINT_SIZE });
    }

    function copySelection() {
        const s = selection.current;
        if (!s) return;
        clipboard.current = {
            pixels: s.pixels ? s.pixels.slice() : copyRegion(bitmap.current, s),
            w: s.w,
            h: s.h,
        };
    }

    // Removes the selected pixels, leaving the background colour
    function deleteSelection() {
        const s = selection.current;
        if (!s) return;
        if (s.pixels && s.base && s.before) {
            bitmap.current.set(s.base);
            commit(s.before);
        } else {
            const before = bitmap.current.slice();
            fillRegion(bitmap.current, s, background);
            commit(before);
        }
        selection.current = null;
        selectDrag.current = null;
        setSelectionBox(null);
        show();
    }

    function cutSelection() {
        copySelection();
        deleteSelection();
    }

    // Puts what was copied in the top left corner, ready to be moved
    function pasteSelection() {
        const copied = clipboard.current;
        if (!copied) return;
        finishSelection();
        setTool("select");
        selection.current = {
            x: 0,
            y: 0,
            w: copied.w,
            h: copied.h,
            pixels: copied.pixels.slice(),
            base: bitmap.current.slice(),
            before: bitmap.current.slice(),
        };
        layDownSelection();
        showSelectionBox();
    }

    function handleSelectDown(e: ReactPointerEvent<HTMLCanvasElement>) {
        if (drag.current || selectDrag.current || e.button !== 0) return;
        e.preventDefault();
        setMenu(null);
        const { x, y } = pixelAt(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        const s = selection.current;
        if (s && x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h) {
            liftSelection();
            selectDrag.current = {
                pointerId: e.pointerId,
                kind: "move",
                start: { x, y },
                origin: { x: s.x, y: s.y },
            };
            return;
        }
        finishSelection();
        selectDrag.current = {
            pointerId: e.pointerId,
            kind: "marquee",
            start: { x, y },
            origin: { x, y },
        };
    }

    // Returns whether the pointer move was part of working with a selection
    function moveSelectDrag(
        e: ReactPointerEvent<HTMLCanvasElement>,
        x: number,
        y: number,
    ): boolean {
        const d = selectDrag.current;
        if (!d || d.pointerId !== e.pointerId) return false;
        if (d.kind === "marquee") {
            if (x !== d.start.x || y !== d.start.y || selection.current) {
                selectRegion(regionBetween(d.start, { x, y }));
            }
        } else if (selection.current) {
            selection.current.x = d.origin.x + (x - d.start.x);
            selection.current.y = d.origin.y + (y - d.start.y);
            layDownSelection();
            showSelectionBox();
        }
        return true;
    }

    function endSelectDrag(e: ReactPointerEvent<HTMLCanvasElement>): boolean {
        const d = selectDrag.current;
        if (!d || d.pointerId !== e.pointerId) return false;
        selectDrag.current = null;
        return true;
    }

    function chooseTool(next: Tool) {
        if (next !== "select") finishSelection();
        if (next === "picker" && tool !== "picker") previousTool.current = tool;
        setTool(next);
    }

    function zoomBy(direction: 1 | -1) {
        const i = ZOOMS.indexOf(zoom);
        const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + direction))];
        setZoom(next);
    }

    function pixelAt(e: ReactPointerEvent<HTMLCanvasElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: Math.floor(((e.clientX - rect.left) / rect.width) * PAINT_SIZE),
            y: Math.floor(((e.clientY - rect.top) / rect.height) * PAINT_SIZE),
        };
    }

    function drawStep(d: Drag, x: number, y: number) {
        const b = bitmap.current;
        if (d.tool === "pencil") {
            strokeLine(
                b,
                d.last.x,
                d.last.y,
                x,
                y,
                brushOffsets("square", 1),
                d.color,
            );
        } else if (d.tool === "brush") {
            strokeLine(
                b,
                d.last.x,
                d.last.y,
                x,
                y,
                brushOffsets(brush.shape, brush.size),
                d.color,
            );
        } else if (d.tool === "eraser") {
            strokeLine(
                b,
                d.last.x,
                d.last.y,
                x,
                y,
                brushOffsets("square", eraserSize),
                background,
            );
        }
        d.last = { x, y };
    }

    function previewShape(d: Drag, x: number, y: number) {
        if (!d.base) return;
        const b = bitmap.current;
        b.set(d.base);
        if (d.tool === "line") {
            strokeLine(b, d.start.x, d.start.y, x, y, penOffsets(lineWidth), d.color);
        } else {
            const kind: ShapeKind =
                d.tool === "rectangle"
                    ? "rectangle"
                    : d.tool === "ellipse"
                        ? "ellipse"
                        : "rounded";
            drawShape(
                b,
                kind,
                d.start,
                { x, y },
                lineWidth,
                fillStyle,
                d.color,
                d.other,
            );
        }
    }

    function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
        if (tool === "select") return handleSelectDown(e);
        if (drag.current || (e.button !== 0 && e.button !== 2)) return;
        e.preventDefault();
        setMenu(null);
        const right = e.button === 2;
        const color = right ? background : foreground;
        const other = right ? foreground : background;
        const { x, y } = pixelAt(e);

        if (tool === "picker") {
            const picked = getPixel(bitmap.current, x, y);
            if (picked) (right ? setBackground : setForeground)(picked);
            setTool(previousTool.current);
            return;
        }
        if (tool === "magnifier") {
            zoomBy(right ? -1 : 1);
            return;
        }
        if (tool === "fill") {
            const before = bitmap.current.slice();
            if (floodFill(bitmap.current, x, y, color)) {
                commit(before);
                show();
            }
            return;
        }

        e.currentTarget.setPointerCapture(e.pointerId);
        const isShape =
            tool === "line" ||
            tool === "rectangle" ||
            tool === "ellipse" ||
            tool === "rounded";
        const d: Drag = {
            tool,
            pointerId: e.pointerId,
            color,
            other,
            start: { x, y },
            last: { x, y },
            before: bitmap.current.slice(),
            base: isShape ? bitmap.current.slice() : null,
            timer: null,
        };
        drag.current = d;

        if (isShape) {
            previewShape(d, x, y);
        } else if (tool === "airbrush") {
            const puff = () => {
                spray(
                    bitmap.current,
                    d.last.x,
                    d.last.y,
                    airbrushSize,
                    Math.ceil(airbrushSize * 1.2),
                    d.color,
                );
                show();
            };
            puff();
            d.timer = window.setInterval(puff, 30);
            return;
        } else {
            drawStep(d, x, y);
        }
        show();
    }

    function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
        const { x, y } = pixelAt(e);
        const inside = x >= 0 && y >= 0 && x < PAINT_SIZE && y < PAINT_SIZE;
        setPosition(inside ? { x, y } : null);
        if (moveSelectDrag(e, x, y)) return;

        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        if (d.base) {
            previewShape(d, x, y);
        } else if (d.tool === "airbrush") {
            d.last = { x, y };
            return;
        } else {
            drawStep(d, x, y);
        }
        show();
    }

    function finishStroke(e: ReactPointerEvent<HTMLCanvasElement>) {
        if (endSelectDrag(e)) return;
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        if (d.timer) window.clearInterval(d.timer);
        drag.current = null;
        commit(d.before);
    }

    // Menus

    const canUndo = undoStack.current.length > 0;
    const canRedo = redoStack.current.length > 0;
    const menus: { name: string; items: MenuItem[] }[] = [
        {
            name: "File",
            items: [
                {
                    label: "New",
                    keys: "Ctrl+N",
                    run: () => change((b) => fillAll(b, WHITE)),
                },
                "rule",
                { label: "Use This Picture", keys: "Ctrl+S", run: save },
                "rule",
                { label: "Exit", run: onCancel },
            ],
        },
        {
            name: "Edit",
            items: [
                { label: "Undo", keys: "Ctrl+Z", run: undo, disabled: !canUndo },
                { label: "Repeat", keys: "Ctrl+Y", run: redo, disabled: !canRedo },
                "rule",
                {
                    label: "Cut",
                    keys: "Ctrl+X",
                    run: cutSelection,
                    disabled: !selectionBox,
                },
                {
                    label: "Copy",
                    keys: "Ctrl+C",
                    run: copySelection,
                    disabled: !selectionBox,
                },
                {
                    label: "Paste",
                    keys: "Ctrl+V",
                    run: pasteSelection,
                    disabled: !clipboard.current,
                },
                {
                    label: "Clear Selection",
                    keys: "Del",
                    run: deleteSelection,
                    disabled: !selectionBox,
                },
                { label: "Select All", keys: "Ctrl+A", run: selectAll },
                "rule",
                {
                    label: "Clear Image",
                    keys: "Ctrl+Shift+N",
                    run: () => change((b) => fillAll(b, background)),
                },
            ],
        },
        {
            name: "View",
            items: ZOOMS.map((z) => ({
                label: `${z * 100}%${z === zoom ? "  ✓" : ""}`,
                run: () => setZoom(z),
            })),
        },
        {
            name: "Image",
            items: [
                { label: "Flip Horizontal", run: () => change(flipHorizontal) },
                { label: "Flip Vertical", run: () => change(flipVertical) },
                { label: "Rotate Right", run: () => change((b) => rotate(b, true)) },
                { label: "Rotate Left", run: () => change((b) => rotate(b, false)) },
                "rule",
                {
                    label: "Invert Colors",
                    keys: "Ctrl+I",
                    run: () => change(invertColors),
                },
            ],
        },
        {
            name: "Colors",
            items: [
                {
                    label: "Edit Colors...",
                    run: () => colorInput.current?.click(),
                },
            ],
        },
        {
            name: "Help",
            items: [{ label: "About Paint", run: () => setAbout(true) }],
        },
    ];

    function handleKeyDown(e: React.KeyboardEvent) {
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (about) setAbout(false);
            else if (menu !== null) setMenu(null);
            else onCancel();
        } else if (mod && key === "z" && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
            e.preventDefault();
            redo();
        } else if (mod && key === "s") {
            e.preventDefault();
            save();
        } else if (mod && key === "i") {
            e.preventDefault();
            change(invertColors);
        } else if (mod && key === "a") {
            e.preventDefault();
            selectAll();
        } else if (mod && key === "c") {
            e.preventDefault();
            copySelection();
        } else if (mod && key === "x") {
            e.preventDefault();
            cutSelection();
        } else if (mod && key === "v") {
            e.preventDefault();
            pasteSelection();
        } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            deleteSelection();
        } else if (mod && key === "n") {
            e.preventDefault();
            change((b) => fillAll(b, e.shiftKey ? background : WHITE));
        }
    }

    const help = hoverHelp || TOOLS.find(([name]) => name === tool)?.[2] || "";

    function options(): ReactNode {
        switch (tool) {
            case "select":
                return [false, true].map((transparent) => (
                    <Option
                        key={String(transparent)}
                        pressed={selectTransparent === transparent}
                        label={
                            transparent
                                ? "Transparent: the background colour shows what is under it"
                                : "Opaque: the background colour is kept"
                        }
                        onClick={() => {
                            setSelectTransparent(transparent);
                            layDownSelection(transparent);
                        }}
                    >
                        <SelectSample transparent={transparent} />
                    </Option>
                ));
            case "eraser":
                return ERASER_SIZES.map((size) => (
                    <Option
                        key={size}
                        pressed={eraserSize === size}
                        label={`${size} pixels`}
                        onClick={() => setEraserSize(size)}
                    >
                        <span
                            style={{
                                display: "block",
                                width: size,
                                height: size,
                                background: "currentColor",
                            }}
                        />
                    </Option>
                ));
            case "brush":
                return BRUSH_SHAPES.flatMap((shape) =>
                    BRUSH_SIZES.map((size) => (
                        <Option
                            key={`${shape}${size}`}
                            pressed={brush.shape === shape && brush.size === size}
                            label={`${shape} brush, ${size} pixels`}
                            onClick={() => setBrush({ shape, size })}
                        >
                            <BrushSample shape={shape} size={size} />
                        </Option>
                    )),
                );
            case "airbrush":
                return AIRBRUSH_SIZES.map((size) => (
                    <Option
                        key={size}
                        pressed={airbrushSize === size}
                        label={`Airbrush ${size} pixels`}
                        onClick={() => setAirbrushSize(size)}
                    >
                        <SpraySample size={size} />
                    </Option>
                ));
            case "line":
                return LINE_WIDTHS.map((width) => (
                    <Option
                        key={width}
                        pressed={lineWidth === width}
                        label={`Line ${width} pixels wide`}
                        onClick={() => setLineWidth(width)}
                    >
                        <span
                            style={{
                                display: "block",
                                width: "100%",
                                height: width,
                                background: "currentColor",
                            }}
                        />
                    </Option>
                ));
            case "rectangle":
            case "ellipse":
            case "rounded":
                return FILL_STYLES.map((style) => (
                    <Option
                        key={style}
                        pressed={fillStyle === style}
                        label={
                            style === "outline"
                                ? "Outline"
                                : style === "both"
                                    ? "Outline and fill"
                                    : "Fill"
                        }
                        onClick={() => setFillStyle(style)}
                    >
                        <FillSample style={style} />
                    </Option>
                ));
            case "magnifier":
                return ZOOMS.map((z) => (
                    <Option
                        key={z}
                        pressed={zoom === z}
                        label={`${z}x`}
                        onClick={() => setZoom(z)}
                    >
                        {z}x
                    </Option>
                ));
            default:
                return null;
        }
    }

    return createPortal(
        <div className="paint-backdrop">
            <div
                ref={root}
                role="dialog"
                aria-modal="true"
                aria-label="Paint"
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                className="paint"
            >
                <div className="paint-titlebar">
                    <PixelIcon name="palette" />
                    <span className="paint-title">untitled - Paint</span>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onCancel}
                        className="paint-close paint-raised"
                    >
                        ×
                    </button>
                </div>

                <div ref={menubar} className="paint-menubar" role="menubar">
                    {menus.map((m) => (
                        <span key={m.name} className="paint-menu">
                            <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={menu === m.name}
                                data-open={menu === m.name}
                                onClick={() => setMenu(menu === m.name ? null : m.name)}
                                onMouseEnter={() => menu !== null && setMenu(m.name)}
                                className="paint-menu-label"
                            >
                                {m.name}
                            </button>
                            {menu === m.name && (
                                <div className="paint-dropdown" role="menu">
                                    {m.items.map((item, i) =>
                                        item === "rule" ? (
                                            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
                                            <div key={i} className="paint-menu-rule" />
                                        ) : (
                                            <button
                                                key={item.label}
                                                type="button"
                                                role="menuitem"
                                                disabled={item.disabled}
                                                onClick={() => {
                                                    setMenu(null);
                                                    item.run();
                                                }}
                                                className="paint-menu-item"
                                            >
                                                <span>{item.label}</span>
                                                {item.keys && <span>{item.keys}</span>}
                                            </button>
                                        ),
                                    )}
                                </div>
                            )}
                        </span>
                    ))}
                </div>

                <div className="paint-body">
                    <div className="paint-side">
                        <div className="paint-toolbox">
                            {TOOLS.map(([name, label, text]) => (
                                <button
                                    key={name}
                                    type="button"
                                    aria-pressed={tool === name}
                                    aria-label={label}
                                    title={label}
                                    onClick={() => chooseTool(name)}
                                    onMouseEnter={() => setHoverHelp(text)}
                                    onMouseLeave={() => setHoverHelp("")}
                                    className="paint-tool"
                                >
                                    {name === "select" ? (
                                        <SelectIcon />
                                    ) : (
                                        <PixelIcon name={name} />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div
                            className="paint-options paint-sunken"
                            data-grid={tool === "brush"}
                        >
                            {options()}
                        </div>
                    </div>

                    <div className="paint-workspace">
                        <div className="paint-canvas-frame">
                            <canvas
                                ref={canvas}
                                width={PAINT_SIZE}
                                height={PAINT_SIZE}
                                aria-label="Your drawing"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={finishStroke}
                                onPointerCancel={finishStroke}
                                onPointerLeave={() => setPosition(null)}
                                className="paint-canvas"
                                style={{
                                    width: PAINT_SIZE * zoom,
                                    height: PAINT_SIZE * zoom,
                                }}
                            />
                            {selectionBox && (
                                <div
                                    className="paint-selection"
                                    style={{
                                        left: selectionBox.x * zoom,
                                        top: selectionBox.y * zoom,
                                        width: selectionBox.w * zoom,
                                        height: selectionBox.h * zoom,
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="paint-colorbar">
                    <button
                        type="button"
                        onClick={() => {
                            setForeground(background);
                            setBackground(foreground);
                        }}
                        aria-label="Swap the front and back colours"
                        title="Swap the front and back colours"
                        className="paint-colorbox paint-sunken"
                    >
                        <span
                            className="paint-current"
                            data-which="bg"
                            style={{ background: rgbCss(background) }}
                        />
                        <span
                            className="paint-current"
                            data-which="fg"
                            style={{ background: rgbCss(foreground) }}
                        />
                    </button>
                    <div className="paint-palette">
                        {PALETTE.flat().map((color, i) => (
                            <button
                                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed palette
                                key={i}
                                type="button"
                                aria-label={rgbHex(color)}
                                title={rgbHex(color)}
                                onClick={() => setForeground(color)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setBackground(color);
                                }}
                                className="paint-swatch"
                            >
                                <span style={{ background: rgbCss(color) }} />
                            </button>
                        ))}
                    </div>
                    <input
                        ref={colorInput}
                        type="color"
                        value={rgbHex(foreground)}
                        onChange={(e) => {
                            const n = Number.parseInt(e.target.value.slice(1), 16);
                            setForeground([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
                        }}
                        tabIndex={-1}
                        aria-hidden="true"
                        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
                    />
                </div>

                <div className="paint-statusbar">
                    <span className="paint-status" data-grow="true">
                        {help}
                    </span>
                    <span className="paint-status" data-fixed="true">
                        {position ? `${position.x}, ${position.y}` : ""}
                    </span>
                    <span className="paint-status" data-fixed="true">
                        {PAINT_SIZE}x{PAINT_SIZE}
                    </span>
                </div>

                <div className="paint-footer">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={!canUndo}
                        className="paint-push paint-undo"
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        data-default="true"
                        className="paint-push"
                    >
                        Use This Picture
                    </button>
                    <button type="button" onClick={onCancel} className="paint-push">
                        Cancel
                    </button>
                </div>

                {about && (
                    <div
                        className="paint-dialog"
                        role="alertdialog"
                        aria-label="About Paint"
                    >
                        <div className="paint-titlebar">
                            <span className="paint-title">About Paint</span>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setAbout(false)}
                                className="paint-close paint-raised"
                            >
                                ×
                            </button>
                        </div>
                        <div className="paint-dialog-body">
                            <strong>Paint</strong>
                            <br />
                            Left button draws in the front colour, right button in the back
                            colour.
                            <br />
                            Make something good.
                        </div>
                        <button
                            type="button"
                            onClick={() => setAbout(false)}
                            className="paint-push"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}