import type { Library } from "@/api/types";
import { libGradient, libraryTypeLabel } from "@/lib/library";
import { absoluteUrl } from "@/lib/mediaUrl";
import { useTranslation } from "react-i18next";
import "./LibraryCard.css";

type Props = {
  library: Library;
  onClick: () => void;
};

export default function LibraryCard({ library, onClick }: Props) {
  const { t } = useTranslation();
  const [c1, c2, c3] = libGradient(library.type, library.id);
  const preview = library.preview_url ? absoluteUrl(library.preview_url) : null;

  return (
    <button type="button" className="library-card" onClick={onClick}>
      <div
        className="library-card-cover"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2}, ${c3})` }}
      >
        {preview ? <img src={preview} alt="" className="library-card-preview" /> : null}
        <span className="library-card-badge">{libraryTypeLabel(library.type, t)}</span>
      </div>
      <div className="library-card-meta">
        <div className="library-card-name">{library.name}</div>
        <div className="library-card-count">{t("library.media_count", { count: library.media_count ?? 0 })}</div>
      </div>
    </button>
  );
}
