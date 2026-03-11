// BlogsContext.jsx — Backward-compatibility shim
// All logic now lives in UpdatesContext.jsx.
// This file re-exports everything under the legacy names so that any
// remaining import of BlogsContext continues to work without modification.
export { UpdatesProvider as BlogsProvider, useUpdates as useBlogs } from "./UpdatesContext";
