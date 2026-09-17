import { useApp } from "../context/AppContext.jsx";

export default function ErrorToast() {
  const { error, clearError } = useApp();
  if (!error) return null;
  return (
    <div className="error error-toast">
      <button type="button" className="toast-close" aria-label="Cerrar" onClick={clearError}>×</button>
      <div>
        <strong>{error.message}</strong>
        {error.detail ? <small>{error.detail}</small> : null}
      </div>
    </div>
  );
}
