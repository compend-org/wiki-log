"use client";

import dynamic from "next/dynamic";

// TeX math, loaded only on pages with math in them
export default dynamic(() => import("./TeXMarkup"));
