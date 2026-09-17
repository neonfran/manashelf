import { useMemo, useState } from "react";
import InfoDot from "./InfoDot.jsx";

// Generic click-header-to-sort table, matching the original's numeric/locale-aware sort.
export default function SortableTable({ headers, rows, className = "" }) {
  const [sort, setSort] = useState(null); // { index, dir }

  const cellText = (cell) => (typeof cell === "string" || typeof cell === "number" ? String(cell) : cell?.props?.children ?? "");
  const cellValue = (cell) => {
    const raw = cellText(cell).trim().replace(/%/g, "").replace(/^T/i, "");
    const n = Number(raw);
    return Number.isFinite(n) && raw !== "" ? n : cellText(cell).trim().toLocaleLowerCase("es");
  };

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { index, dir } = sort;
    return [...rows].sort((a, b) => {
      const av = cellValue(a[index]), bv = cellValue(b[index]);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "es", { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const toggle = (i) => setSort((s) => ({ index: i, dir: s?.index === i && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <table className={`sortable-table ${className}`}>
      <thead>
        <tr>
          {headers.map((h, i) => {
            const label = typeof h === "string" ? h : h.label;
            const info = typeof h === "string" ? null : h.info;
            return (
              <th key={i} className="sortable-col" tabIndex={0} role="button" onClick={() => toggle(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(i); } }}>
                {label} {info && <InfoDot text={info} />}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, ri) => (
          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
