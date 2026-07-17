import { useEffect, useMemo, useRef } from "react";
import {
  AudioWaveform, BadgeCheck, CircleAlert, CirclePause, CirclePlay, Repeat, Zap, Gauge, RotateCcw, Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "../motion-primitives";
import { PageHeader } from "../PageHeader";
import { useWorkspace } from "@/lib/workspace-context";
import { useKeyAnalysisEngine } from "@/hooks/useKeyAnalysisEngine";
import { keyAnalysisEngine } from "@/lib/key-analysis/engine";
import { useRobotJournal } from "@/hooks/useRobotJournal";

function formatMs(ms: number): string {
  if (!ms || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r}s`;
}

/**
 * Analyse tab — foundation for automatic key/tonality detection.
 *
 * The BPM field is filled exclusively by the DiscDJ Robot, per project
 * decision. Tonality analysis is not wired to an engine yet: this tab
 * exposes the persisted state (done / pending / error), the progress
 * across the whole library and the per-track breakdown so a future
 * engine (Essentia WASM, cloud, ...) can plug in without any UI change.
 */
export function AnalysisTab() {
  const { project } = useWorkspace();
  const engine = useKeyAnalysisEngine();
  const robotJournal = useRobotJournal();
  const robotLogRef = useRef<HTMLUListElement | null>(null);

  const stats = useMemo(() => {
    const tracks = project?.tracks ?? [];
    const withKey = tracks.filter((t) => !!t.musicalKey).length;
    const withBpm = tracks.filter((t) => t.bpm != null).length;
    return {
      total: tracks.length,
      withKey,
      withBpm,
      pending: tracks.filter((t) => t.analysisStatus === "pending").length,
      errors: tracks.filter((t) => t.analysisStatus === "error").length,
    };
  }, [project]);

  const pct = stats.total === 0 ? 0 : Math.round((stats.withKey / stats.total) * 100);
  const speed = engine.avgMsPerTrack > 0
    ? `${(60000 / engine.avgMsPerTrack).toFixed(1)}/min`
    : "—";
  const robotEntries = robotJournal.entries;

  useEffect(() => {
    if (robotLogRef.current) robotLogRef.current.scrollTop = 0;
  }, [robotEntries.length]);

  if (!project) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={AudioWaveform}
        eyebrow="Analyse"
        title="Détection des tonalités"
        subtitle="Moteur hybride local. Priorité automatique quand le Robot est actif."
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl border border-border bg-surface p-4"
      >
        {/* Animated waveform bars in the background */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center gap-[3px] opacity-30">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="block w-[3px] rounded-full bg-primary"
              animate={{ height: [6, 22, 10, 26, 8], opacity: [0.4, 1, 0.6, 1, 0.4] }}
              transition={{ duration: 1.4 + (i % 4) * 0.25, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
            />
          ))}
        </div>
        <div className="relative flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-10 w-10 place-items-center rounded-lg bg-accent/40 text-primary"
          >
            <AudioWaveform className="h-5 w-5" strokeWidth={1.75} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">Analyse des tonalités</p>
            <p className="text-[11px] text-muted-foreground">
              {stats.withKey} / {stats.total} tonalités détectées
              {engine.slowMode && " · Mode ralenti (Robot prioritaire)"}
            </p>
          </div>
          <span className="text-lg font-semibold text-primary tabular-nums">{pct}%</span>
        </div>
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
          <motion.div
            className="h-full bg-gradient-gold"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <AnimatePresence>
          {engine.currentTrackName && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative mt-2 truncate text-[11px] text-muted-foreground"
            >
              En cours : <span className="text-foreground">{engine.currentTrackName}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total" value={String(engine.total)} />
        <StatCard label="Restants" value={String(engine.pending)} />
        <StatCard label="Erreurs" value={String(engine.errors)} tone={engine.errors > 0 ? "warn" : undefined} />
        <StatCard label="Temps restant" value={formatMs(engine.etaMs)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Vitesse" value={speed} icon={<Gauge className="h-3 w-3" />} />
        <StatCard
          label="Dernier"
          value={engine.lastAnalyzed
            ? `${engine.lastAnalyzed.key}${engine.lastAnalyzed.camelot ? ` · ${engine.lastAnalyzed.camelot}` : ""}`
            : "—"}
          icon={<Zap className="h-3 w-3" />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {engine.running && !engine.paused ? (
          <MotionButton
            onClick={() => keyAnalysisEngine.pause()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium hover:border-border-strong"
          >
            <CirclePause className="h-3.5 w-3.5" strokeWidth={1.75} /> Suspendre
          </MotionButton>
        ) : (
          <MotionButton
            onClick={() => (engine.paused ? keyAnalysisEngine.resume() : keyAnalysisEngine.start())}
            whileHover={{ y: -2, scale: 1.03, boxShadow: "0 10px 24px -8px rgba(93,214,44,0.55)" }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-gold"
          >
            <CirclePlay className="h-3.5 w-3.5" strokeWidth={1.75} /> {engine.paused ? "Reprendre" : "Démarrer"}
          </MotionButton>
        )}
        <MotionButton
          onClick={() => { keyAnalysisEngine.requeue("errors"); keyAnalysisEngine.start(); }}
          disabled={engine.errors === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Repeat className="h-3.5 w-3.5" strokeWidth={1.75} /> Réanalyser erreurs
        </MotionButton>
        <MotionButton
          onClick={() => {
            if (window.confirm("Réanalyser toute la bibliothèque ?")) {
              keyAnalysisEngine.requeue("all");
              keyAnalysisEngine.start();
            }
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium hover:border-border-strong"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} /> Tout réanalyser
        </MotionButton>
      </div>

      <ul className="overflow-hidden rounded-xl border border-border bg-surface">
        {project.tracks.slice(0, 40).map((t) => (
          <li key={t.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0">
            <StatusDot trackId={t.id} hasKey={!!t.musicalKey} />
            <span className="flex-1 truncate">{t.name}</span>
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {t.musicalKey ?? "—"} {t.camelot ? `· ${t.camelot}` : ""}
            </span>
          </li>
        ))}
        {project.tracks.length > 40 && (
          <li className="px-3 py-2 text-center text-[11px] text-muted-foreground">
            + {project.tracks.length - 40} pistes…
          </li>
        )}
      </ul>

      <section>
        <h3 className="mb-2 px-1 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Journal des analyses
        </h3>
        <ul className="max-h-64 overflow-auto rounded-xl border border-border bg-surface">
          {engine.log.length === 0 && (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              Aucune activité pour le moment.
            </li>
          )}
          {engine.log.map((entry) => (
            <li
              key={entry.ts + entry.message}
              className="flex items-start gap-2 border-b border-border/60 px-3 py-1.5 text-[11px] last:border-b-0"
            >
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  entry.level === "error"
                    ? "bg-destructive"
                    : entry.level === "warn"
                      ? "bg-amber-400"
                      : "bg-primary"
                }`}
              />
              <span className="flex-1 text-foreground/90">{entry.message}</span>
              <span className="text-muted-foreground tabular-nums">
                {new Date(entry.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-3">
        <header className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Journal Robot DiscDJ
              </h3>
              <p className="truncate text-[10px] text-muted-foreground">Actions en temps réel et diagnostic persistant</p>
            </div>
          </div>
          {robotEntries.length > 0 && (
            <button
              onClick={robotJournal.clear}
              className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-[10px] font-semibold text-muted-foreground hover:border-destructive/60 hover:text-destructive"
            >
              Vider
            </button>
          )}
        </header>
        <ul ref={robotLogRef} className="max-h-80 overflow-auto rounded-lg border border-border/70 bg-background/60">
          {robotEntries.length === 0 && (
            <li className="px-3 py-3 text-center text-[11px] text-muted-foreground">
              Aucun événement Robot pour le moment.
            </li>
          )}
          {robotEntries.map((entry) => {
            const tone = entry.level ?? (entry.outcome === "success" ? "success" : entry.outcome === "error" ? "error" : entry.outcome === "retry" ? "warning" : "info");
            return (
              <li key={`${entry.ts}-${entry.trackId ?? entry.message ?? "robot"}`} className="flex items-start gap-2 border-b border-border/60 px-3 py-2 text-[11px] last:border-b-0">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "error" ? "bg-destructive" : tone === "warning" ? "bg-amber-400" : tone === "success" ? "bg-emerald-500" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-foreground/90">{entry.message ?? entry.name ?? "Action Robot"}</p>
                  {entry.name && entry.kind !== "action" && <p className="truncate text-[10px] text-muted-foreground">{entry.name}</p>}
                  {entry.diagnosticImage && (
                    <div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-background/70">
                      <p className="px-2 py-1 text-[10px] text-muted-foreground">
                        {entry.diagnosticLabel ?? "Capture OCR enregistrée"}
                      </p>
                      <img
                        src={entry.diagnosticImage}
                        alt={entry.diagnosticLabel ?? "Capture OCR réellement analysée"}
                        className="max-h-40 w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label, value, tone, icon,
}: {
  label: string; value: string; tone?: "warn"; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-surface px-3 py-2.5 ${tone === "warn" ? "border-amber-500/40" : "border-border"}`}>
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </p>
      <p className={`mt-1 font-display text-lg font-semibold tabular-nums ${tone === "warn" ? "text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}

function StatusDot({ trackId, hasKey }: { trackId: string; hasKey: boolean }) {
  const engine = useKeyAnalysisEngine();
  const current = engine.currentTrackName;
  const isCurrent = current && engine.log[0]?.message.startsWith(current);
  // Fallback: highlight the current-name row.
  void isCurrent; void trackId;
  if (hasKey) return <BadgeCheck className="h-3.5 w-3.5 text-primary" />;
  return <CircleAlert className="h-3.5 w-3.5 text-muted-foreground/50" />;
}
