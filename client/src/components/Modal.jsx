import { useApp } from "../context/AppContext.jsx";
import CommanderPreviewModal from "./CommanderPreviewModal.jsx";
import Lab2GateModal from "../features/lab2/Lab2GateModal.jsx";
import CacheAdminModal from "./CacheAdminModal.jsx";
import AlternativesModal from "../features/shared/AlternativesModal.jsx";
import AddCutModal from "../features/shared/AddCutModal.jsx";
import AssistModal from "../features/shared/AssistModal.jsx";

const REGISTRY = {
  commander: CommanderPreviewModal,
  lab2gate: Lab2GateModal,
  cacheAdmin: CacheAdminModal,
  alternatives: AlternativesModal,
  addcut: AddCutModal,
  assist: AssistModal,
};

export default function Modal() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  const Content = REGISTRY[modal.type];
  if (!Content) return null;
  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal-card">
        <button className="modal-x" onClick={closeModal}>×</button>
        <div><Content {...modal.props} /></div>
      </div>
    </div>
  );
}
