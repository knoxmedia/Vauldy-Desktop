import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlayerStore } from "@/store/player";
import { mpvStop, mpvTogglePause } from "@/hooks/useMpv";

export default function MusicBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mediaId, title, poster, playing } = usePlayerStore();

  if (!mediaId) return null;

  return (
    <div className="music-bar">
      {poster ? <img src={poster} alt="" className="music-bar-poster" /> : <div className="music-bar-poster" />}
      <button
        type="button"
        className="music-bar-title"
        onClick={() => navigate(`/player/${mediaId}`)}
        style={{ background: "none", border: "none", color: "inherit", textAlign: "left" }}
      >
        {title}
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => void mpvTogglePause()}>
        {playing ? t("player.pause") : t("player.play")}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          void mpvStop();
          usePlayerStore.getState().clear();
        }}
      >
        {t("player.stop")}
      </button>
    </div>
  );
}
