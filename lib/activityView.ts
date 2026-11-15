// ABOUTME: Says whose activity a page shows when it isn't the signed-in person's own.
// ABOUTME: Without one, the diary and likes pages are the viewer's own, with edit and delete buttons.

// Who is looking (undefined when signed out), and whose activity it is
export type ActivityView = { viewerId: string | undefined; ownerName: string };
