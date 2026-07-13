import { Select, message } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useT } from "@/i18n";
import {
  getPlayerEnginePref,
  setPlayerEnginePref,
  type PlayerEnginePref,
} from "@/lib/playbackStrategy";
import { isTauri } from "@/hooks/useMpv";
import styles from "@web/pages/Settings.module.css";

export default function DesktopPlayerSettings() {
  const t = useT();
  const [engine, setEngine] = useState<PlayerEnginePref>(() => getPlayerEnginePref());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlayerEnginePref>(engine);

  const options = useMemo(
    () => [
      { value: "auto" as const, label: t("desktop.player_engine.auto") },
      { value: "web" as const, label: t("desktop.player_engine.web") },
      { value: "mpv" as const, label: t("desktop.player_engine.mpv") },
    ],
    [t],
  );

  const valueLabel = options.find((o) => o.value === engine)?.label ?? engine;

  const openEdit = useCallback(() => {
    setDraft(engine);
    setEditing(true);
  }, [engine]);

  const save = useCallback(() => {
    setEngine(draft);
    setPlayerEnginePref(draft);
    setEditing(false);
    message.success(t("desktop.player_engine.success"));
  }, [draft, t]);

  if (!isTauri()) return null;

  if (!editing) {
    return (
      <div className={styles.row}>
        <div>
          <div className={styles.label}>{t("desktop.player_engine.title")}</div>
          <div className={styles.value}>{valueLabel}</div>
        </div>
        <button type="button" className={styles.edit} onClick={openEdit}>
          {t("common.edit")}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>{t("desktop.player_engine.title")}</span>
        <button type="button" className={styles.cancel} onClick={() => setEditing(false)}>
          {t("common.cancel")}
        </button>
      </div>
      <p className={styles.hint} style={{ marginBottom: 16 }}>
        {t("desktop.player_engine.desc")}
      </p>
      <div className={styles.formStack}>
        <div>
          <div className={styles.fieldLabel}>{t("desktop.player_engine.label")}</div>
          <Select<PlayerEnginePref>
            style={{ width: "100%", maxWidth: 400 }}
            value={draft}
            onChange={setDraft}
            options={options}
          />
        </div>
      </div>
      <div className={styles.saveRow}>
        <button
          type="button"
          className={`${styles.saveBtn} ${styles.saveBtnActive}`}
          onClick={save}
        >
          {t("desktop.player_engine.save")}
        </button>
      </div>
    </div>
  );
}
