import { useApp } from "./context/AppContext.jsx";
import Header from "./components/Header.jsx";
import LoginPanel from "./components/LoginPanel.jsx";
import AccountBar from "./components/AccountBar.jsx";
import ModeTabs from "./components/ModeTabs.jsx";
import Modal from "./components/Modal.jsx";
import Drawer from "./components/Drawer.jsx";
import CardZoom from "./components/CardZoom.jsx";
import ErrorToast from "./components/ErrorToast.jsx";
import DeckSyncManager from "./components/DeckSyncManager.jsx";
import ExploreFlow from "./features/explore/ExploreFlow.jsx";
import ImproveFlow from "./features/improve/ImproveFlow.jsx";
import RankFlow from "./features/rank/RankFlow.jsx";
import LabFlow from "./features/lab/LabFlow.jsx";
import Lab2Flow from "./features/lab2/Lab2Flow.jsx";
import Lab3Flow from "./features/lab3/Lab3Flow.jsx";

export default function App() {
  const { t, mode, session } = useApp();

  return (
    <>
      <div className="grid-bg"></div><div className="glow glow-a"></div><div className="glow glow-b"></div>
      <Header />
      <main>
        <section className="hero">
          <div className="kicker">{t("HERRAMIENTA COMMANDER BASADA EN TU COLECCIÓN")}</div>
          <h1>{t("Tu colección.")}<br /><span>{t("Tu próximo deck.")}</span></h1>
        </section>

        {!session && <LoginPanel />}
        <AccountBar />
        {session && (
          <>
            <ModeTabs />
            {mode === "explore" && <ExploreFlow />}
            {mode === "improve" && <ImproveFlow />}
            {mode === "rank" && <RankFlow />}
            {mode === "lab" && <LabFlow />}
            {mode === "lab2" && <Lab2Flow />}
            {mode === "lab3" && <Lab3Flow />}
          </>
        )}

        <ErrorToast />
      </main>

      <Modal />
      <Drawer />
      <CardZoom />
      <DeckSyncManager />

      <footer><span>ManaShelf · local-first</span><span>v2.5.57-beta</span></footer>
    </>
  );
}
