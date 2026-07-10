import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchLibraries } from "@/api/client";
import type { Library } from "@/api/types";
import { PageLayout } from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import LibraryCard from "@/components/LibraryCard";
import LoadingState from "@/components/LoadingState";

export default function BrowsePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLibraries()
      .then((libs) => setLibraries(libs.filter((l) => l.enabled !== 0)))
      .catch(() => setLibraries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout title={t("browse.title")}>
      {loading ? (
        <LoadingState />
      ) : libraries.length === 0 ? (
        <EmptyState message={t("browse.empty")} />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {libraries.map((lib) => (
            <LibraryCard key={lib.id} library={lib} onClick={() => navigate(`/library/${lib.id}`)} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
