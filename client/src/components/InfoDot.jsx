import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext.jsx";
import { translateLabInfo } from "../features/shared/labInfoTranslations.js";

export default function InfoDot({ text }) {
  const { lang, t } = useApp();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const ref = useRef(null);
  if (!text) return null;

  const show = () => {
    const dot = ref.current;
    if (!dot) return;
    setVisible(true);
    requestAnimationFrame(() => {
      const r = dot.getBoundingClientRect(), pad = 12, w = 260, h = 90;
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
      let top = r.bottom + 9;
      if (top + h > window.innerHeight - pad) top = Math.max(pad, r.top - h - 9);
      setPos({ left: Math.round(left), top: Math.round(top) });
    });
  };
  const hide = () => setVisible(false);
  const content = lang === "en" ? translateLabInfo(text) : text;

  return (
    <span
      ref={ref}
      className="info-dot"
      tabIndex={0}
      role="button"
      aria-label={t("Información")}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); visible ? hide() : show(); }}
    >
      <span>i</span>
      {visible && createPortal(
        <span className="info-popover visible" role="tooltip" style={{ left: pos.left, top: pos.top, position: "fixed" }}>{content}</span>,
        document.body
      )}
    </span>
  );
}
