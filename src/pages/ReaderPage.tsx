import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  fetchDocumentDetail,
  fetchDocumentPreviewInfo,
  fetchMediaDetail,
  fetchReadProgress,
  saveReadProgress,
} from "@/api/client";
import { PageLayout } from "@/components/AppShell";
import LoadingState from "@/components/LoadingState";
import { documentPreviewSrc, mediaPlaySrc } from "@/lib/mediaUrl";

export default function ReaderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const mediaId = Number(id);
  const [title, setTitle] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [detail, media] = await Promise.all([fetchDocumentDetail(mediaId), fetchMediaDetail(mediaId)]);
        setTitle(detail.title || media.title);
        const ext = (media.format || media.file_path || "").toLowerCase();
        if (ext.endsWith(".pdf")) {
          setUri(mediaPlaySrc(mediaId));
          return;
        }
        if ([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].some((s) => ext.endsWith(s))) {
          const info = await fetchDocumentPreviewInfo(mediaId);
          if (info.preview_ready) setUri(documentPreviewSrc(mediaId));
          else setNotReady(true);
          return;
        }
        setUri(mediaPlaySrc(mediaId));
      } catch {
        setNotReady(true);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      void fetchReadProgress(mediaId)
        .then((p) => {
          if (p) void saveReadProgress(mediaId, p.position, p.percent);
        })
        .catch(() => {});
    };
  }, [mediaId]);

  if (loading) {
    return (
      <PageLayout title={t("reader.loading")}>
        <LoadingState label={t("reader.loading")} />
      </PageLayout>
    );
  }

  if (notReady || !uri) {
    return (
      <PageLayout title={title || t("reader.not_ready")}>
        <div className="empty-state">{t("reader.not_ready")}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={title}>
      <iframe className="reader-frame" src={uri} title={title} />
    </PageLayout>
  );
}
