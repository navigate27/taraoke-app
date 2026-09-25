import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const TOUCH_LONG_PRESS_MS = 250;
const SCROLL_CANCEL_PX = 10;
const GHOST_START_PX = 6;
const EDGE_PX = 48;
const MAX_AUTO_SCROLL_SPEED = 14;

interface PendingDrag {
  itemId: string;
  index: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

// Pointer-based queue row dragging shared by host and guest panels.
// Mouse: drag starts immediately on movement. Touch: long-press first, so
// vertical scrolling still works; while a drag is live, touchmove is
// prevented so the page doesn't scroll out from under the finger.
export function useQueueDrag(onReorder: (itemId: string, toIndex: number) => void) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const autoScrollRef = useRef<{ lastY: number; raf: number } | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const startGhostRef = useRef<((x: number, y: number) => void) | null>(null);

  useEffect(() => {
    function rowAt(clientY: number): HTMLElement | null {
      const rows = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Song queue"] [data-next-list] > div',
        ),
      ];
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) return row;
      }
      return null;
    }

    function startAutoScroll(clientY: number) {
      if (autoScrollRef.current) return;
      const el = document.querySelector<HTMLElement>(
        '[aria-label="Song queue"] [data-queue-scroll]',
      );
      if (!el) return;
      const state = { lastY: clientY, raf: 0 };
      autoScrollRef.current = state;
      const tick = () => {
        const rect = el.getBoundingClientRect();
        let speed = 0;
        if (state.lastY < rect.top + EDGE_PX) {
          speed = -Math.ceil(
            MAX_AUTO_SCROLL_SPEED * ((rect.top + EDGE_PX - state.lastY) / EDGE_PX),
          );
        } else if (state.lastY > rect.bottom - EDGE_PX) {
          speed = Math.ceil(
            MAX_AUTO_SCROLL_SPEED * ((state.lastY - (rect.bottom - EDGE_PX)) / EDGE_PX),
          );
        }
        if (speed !== 0) {
          el.scrollTop += speed;
          const over = rowAt(state.lastY);
          setDragOverIndex(
            over ? [...(over.parentNode?.childNodes ?? [])].indexOf(over) : null,
          );
        }
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
    }

    function stopAutoScroll() {
      const state = autoScrollRef.current;
      if (!state) return;
      cancelAnimationFrame(state.raf);
      autoScrollRef.current = null;
    }

    function queueRows(): HTMLElement[] {
      return [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-label="Song queue"] [data-next-list] > div',
        ),
      ];
    }

    function createGhost(pending: PendingDrag, clientX: number, clientY: number) {
      const row = queueRows()[pending.index];
      if (!row) return;
      const rect = row.getBoundingClientRect();
      pending.offsetX = clientX - rect.left;
      pending.offsetY = clientY - rect.top;
      const ghost = row.cloneNode(true) as HTMLElement;
      ghost.style.position = "fixed";
      ghost.style.width = `${rect.width}px`;
      ghost.style.margin = "0";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.9";
      ghost.style.zIndex = "60";
      ghost.style.transform = "rotate(4deg)";
      ghost.style.left = `${clientX - pending.offsetX}px`;
      ghost.style.top = `${clientY - pending.offsetY}px`;
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
      setDraggingIndex(pending.index);
      startAutoScroll(clientY);
    }

    function cleanup(pending: PendingDrag | null) {
      if (pending?.timer) clearTimeout(pending.timer);
      ghostRef.current?.remove();
      ghostRef.current = null;
      pendingRef.current = null;
      stopAutoScroll();
      setDraggingIndex(null);
      setDragOverIndex(null);
    }

    function onPointerMove(e: PointerEvent) {
      const pending = pendingRef.current;
      if (!pending || !pending.active) {
        if (pending) {
          pending.lastX = e.clientX;
          pending.lastY = e.clientY;
          // Finger moved before the long press fired — treat as a scroll.
          if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) >= SCROLL_CANCEL_PX) {
            cleanup(pending);
          }
        }
        return;
      }
      let ghost = ghostRef.current;
      if (!ghost) {
        if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < GHOST_START_PX) return;
        createGhost(pending, e.clientX, e.clientY);
        return;
      }
      ghost.style.left = `${e.clientX - pending.offsetX}px`;
      ghost.style.top = `${e.clientY - pending.offsetY}px`;
      if (autoScrollRef.current) autoScrollRef.current.lastY = e.clientY;
      else startAutoScroll(e.clientY);
      const over = rowAt(e.clientY);
      setDragOverIndex(over ? [...(over.parentNode?.childNodes ?? [])].indexOf(over) : null);
    }

    function onPointerUp(e: PointerEvent) {
      const pending = pendingRef.current;
      const ghost = ghostRef.current;
      if (!pending && !ghost) return;
      const from = pending?.index ?? null;
      const itemId = pending?.itemId ?? null;
      pendingRef.current = null;
      if (pending?.timer) clearTimeout(pending.timer);
      stopAutoScroll();
      if (!ghost) return;
      ghost.remove();
      ghostRef.current = null;
      const target = rowAt(e.clientY);
      let to: number | null = null;
      if (target) {
        to = [...(target.parentNode?.childNodes ?? [])].indexOf(target);
      }
      if (itemId !== null && from !== null && to !== null && from !== to) {
        onReorderRef.current(itemId, to);
      }
      setDraggingIndex(null);
      setDragOverIndex(null);
    }

    // Once a touch drag is live (from the long press on), stop the browser
    // from scrolling the page.
    function onTouchMove(e: TouchEvent) {
      if (pendingRef.current?.active && e.cancelable) e.preventDefault();
    }

    function onPointerCancel() {
      const pending = pendingRef.current;
      if (pending) cleanup(pending);
    }

    // Long-pressing a row to drag must not open the browser context menu.
    function onContextMenu(e: MouseEvent) {
      if (pendingRef.current || ghostRef.current) e.preventDefault();
    }

    startGhostRef.current = (x, y) => {
      const pending = pendingRef.current;
      if (!pending || ghostRef.current) return;
      createGhost(pending, x, y);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("contextmenu", onContextMenu);
      const pending = pendingRef.current;
      if (pending) cleanup(pending);
    };
  }, []);

  function onRowPointerDown(index: number, itemId: string) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      const pending: PendingDrag = {
        itemId,
        index,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        offsetX: 0,
        offsetY: 0,
        active: e.pointerType !== "touch",
        timer: null,
      };
      if (e.pointerType === "touch") {
        pending.timer = setTimeout(() => {
          pending.active = true;
          // Show the tilt immediately so the user sees the drag is live.
          startGhostRef.current?.(pending.lastX, pending.lastY);
        }, TOUCH_LONG_PRESS_MS);
      }
      pendingRef.current = pending;
    };
  }

  return { draggingIndex, dragOverIndex, onRowPointerDown };
}