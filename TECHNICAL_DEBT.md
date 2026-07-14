# Technical Debt

---

## [TD-001] Question Bank Detail — Virtual Scrolling for Large Question Lists

**Location:** `apps/admin/app/(dashboard)/exam-sets/page.tsx` → `BankDetailPanel`

**Current State:**
The bank detail panel fetches up to 500 questions in one request (`limit=500`) and renders them all into the DOM simultaneously. This works for small banks but degrades heavily beyond ~150 questions: long scroll, slow render, memory pressure.

**Symptoms:**
- Scroll fatigue for admins managing large banks (200+ questions)
- All DOM nodes mounted at once regardless of visibility
- No progressive disclosure — entire list renders on bank expand

**Production-Grade Solution: TanStack Virtual (`@tanstack/react-virtual`)**

This is the correct solution — not "show more" (which is a workaround), not pagination (which breaks search UX).

**Implementation plan:**

1. Install `@tanstack/react-virtual` in the admin app:
   ```
   npm install @tanstack/react-virtual --workspace=apps/admin
   ```

2. Replace the flat `filtered.map(...)` render loop in `BankDetailPanel` with a `useVirtualizer` hook:
   ```tsx
   import { useVirtualizer } from "@tanstack/react-virtual"

   const parentRef = useRef<HTMLDivElement>(null)

   const virtualizer = useVirtualizer({
     count: filtered.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 100, // estimated px height per question card
     overscan: 5,
   })

   return (
     <div ref={parentRef} className="h-[600px] overflow-auto">
       <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
         {virtualizer.getVirtualItems().map((virtualItem) => {
           const q = filtered[virtualItem.index]
           return (
             <div
               key={q.id}
               style={{
                 position: "absolute",
                 top: 0,
                 left: 0,
                 width: "100%",
                 transform: `translateY(${virtualItem.start}px)`,
               }}
             >
               {/* existing question card JSX */}
             </div>
           )
         })}
       </div>
     </div>
   )
   ```

3. Keep the existing client-side search (`filtered`) — virtualizer works on the already-filtered array, so search + virtual scroll compose correctly with zero extra logic.

4. Use `measureElement` callback for dynamic row heights (question texts vary in length):
   ```tsx
   const virtualizer = useVirtualizer({
     count: filtered.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 100,
     measureElement: (el) => el.getBoundingClientRect().height,
     overscan: 5,
   })
   ```

**Why this is the right solution:**
- Renders only ~10-15 DOM nodes regardless of list size (10 or 10,000 questions)
- Search still works client-side on the full dataset — no round trips
- No pagination mental model for the admin
- `@tanstack/react-virtual` is already in the same ecosystem as TanStack Query/Table already used in this project — zero new vendors
- Handles dynamic row heights correctly via `measureElement`

**Effort:** ~2 hours  
**Priority:** Medium — only painful beyond ~200 questions per bank

---
