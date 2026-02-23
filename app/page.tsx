"use client";

import React, { useEffect, useMemo, useState } from "react";
import { create } from "zustand";

type Settings = {
  passingPct: number;      // e.g. 80
  questionsPerSession: number; // e.g. 10
  rewardMinutes: number;   // e.g. 20
  dailyMaxMinutes: number; // e.g. 60
  skill: "multiplication";
};

type Store = {
  settings: Settings;
  earnedMinutesToday: number;
  lastEarnedAtISO: string | null;

  setSettings: (patch: Partial<Settings>) => void;
  addEarnedMinutes: (minutes: number) => void;
  resetDailyIfNeeded: () => void;
};

const DEFAULT_SETTINGS: Settings = {
  passingPct: 80,
  questionsPerSession: 10,
  rewardMinutes: 20,
  dailyMaxMinutes: 60,
  skill: "multiplication",
};

function yyyyMmDd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const useAppStore = create<Store>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  earnedMinutesToday: 0,
  lastEarnedAtISO: null,

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  addEarnedMinutes: (minutes) =>
    set((s) => ({
      earnedMinutesToday: Math.min(
        s.settings.dailyMaxMinutes,
        s.earnedMinutesToday + minutes
      ),
      lastEarnedAtISO: new Date().toISOString(),
    })),

  resetDailyIfNeeded: () => {
    const iso = get().lastEarnedAtISO;
    if (!iso) return;
    const last = new Date(iso);
    const now = new Date();
    if (yyyyMmDd(last) !== yyyyMmDd(now)) {
      set({ earnedMinutesToday: 0 });
    }
  },
}));

type Question = {
  a: number;
  b: number;
  answer: number;
};

function generateMultiplicationQuestions(count: number): Question[] {
  // Simple MVP: 0–12 times tables, weighted toward 6–12 a bit.
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() < 0.65 ? randInt(6, 12) : randInt(0, 12);
    const b = Math.random() < 0.65 ? randInt(6, 12) : randInt(0, 12);
    questions.push({ a, b, answer: a * b });
  }
  return questions;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Mode = "home" | "parent" | "kid" | "play";

export default function Page() {
  const { settings, earnedMinutesToday, setSettings, addEarnedMinutes, resetDailyIfNeeded } =
    useAppStore();

  const [mode, setMode] = useState<Mode>("home");

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [showResult, setShowResult] = useState<string | null>(null);

  // Play timer
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    resetDailyIfNeeded();
  }, [resetDailyIfNeeded]);

  const scorePct = useMemo(() => {
    if (!done) return 0;
    return Math.round((correctCount / settings.questionsPerSession) * 100);
  }, [done, correctCount, settings.questionsPerSession]);

  const canEarnMoreToday = earnedMinutesToday < settings.dailyMaxMinutes;

  function startKidSession() {
    setShowResult(null);
    setDone(false);
    setCorrectCount(0);
    setIdx(0);
    setInput("");
    const qs =
      settings.skill === "multiplication"
        ? generateMultiplicationQuestions(settings.questionsPerSession)
        : [];
    setQuestions(qs);
    setMode("kid");
  }

  function submitAnswer() {
    const q = questions[idx];
    const parsed = Number(input.trim());
    const isCorrect = Number.isFinite(parsed) && parsed === q.answer;
    if (isCorrect) setCorrectCount((c) => c + 1);

    // move forward
    const next = idx + 1;
    setInput("");
    if (next >= questions.length) {
      setDone(true);
      const pct = Math.round(((isCorrect ? correctCount + 1 : correctCount) / settings.questionsPerSession) * 100);
      const passed = pct >= settings.passingPct;

      if (passed && canEarnMoreToday) {
        addEarnedMinutes(settings.rewardMinutes);
        setShowResult(
          `Passed with ${pct}% ✅ Earned ${settings.rewardMinutes} minutes (today: ${Math.min(
            settings.dailyMaxMinutes,
            earnedMinutesToday + settings.rewardMinutes
          )}/${settings.dailyMaxMinutes}).`
        );
        // Move to play screen with newly earned minutes
        const totalEarned = Math.min(settings.dailyMaxMinutes, earnedMinutesToday + settings.rewardMinutes);
        // For MVP, let kid "spend" only the newly earned block:
        setSecondsLeft(settings.rewardMinutes * 60);
        setMode("play");
      } else if (passed && !canEarnMoreToday) {
        setShowResult(
          `Passed with ${pct}% ✅ but you’ve hit today’s max of ${settings.dailyMaxMinutes} minutes.`
        );
      } else {
        setShowResult(
          `Scored ${pct}%. Need ${settings.passingPct}% to unlock. New set generated.`
        );
        // Auto-generate a new set
        const qs = generateMultiplicationQuestions(settings.questionsPerSession);
        setQuestions(qs);
        setIdx(0);
        setCorrectCount(0);
        setDone(false);
      }
      return;
    }
    setIdx(next);
  }

  // Play timer ticking
  useEffect(() => {
    if (mode !== "play") return;
    if (secondsLeft <= 0) return;

    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [mode, secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>LevelED Up</div>
            <div style={styles.subtitle}>Earn game time by leveling up your skills.</div>
          </div>
          <div style={styles.badge}>
            Today earned: <b>{earnedMinutesToday}</b> / {settings.dailyMaxMinutes} min
          </div>
        </div>

        {mode === "home" && (
          <div style={styles.section}>
            <button style={styles.primary} onClick={() => setMode("parent")}>
              Parent Settings
            </button>
            <button style={styles.secondary} onClick={startKidSession}>
              Kid: Start Challenge
            </button>

            <div style={styles.note}>
              MVP notes: this version unlocks an in-app “play timer.” Once validated, we add real device/app gating.
            </div>
          </div>
        )}

        {mode === "parent" && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Parent Settings</h2>

            <label style={styles.label}>
              Passing percentage ({settings.passingPct}%)
              <input
                style={styles.input}
                type="number"
                min={50}
                max={100}
                value={settings.passingPct}
                onChange={(e) => setSettings({ passingPct: clampNum(e.target.value, 50, 100) })}
              />
            </label>

            <label style={styles.label}>
              Questions per session ({settings.questionsPerSession})
              <input
                style={styles.input}
                type="number"
                min={5}
                max={30}
                value={settings.questionsPerSession}
                onChange={(e) =>
                  setSettings({ questionsPerSession: clampNum(e.target.value, 5, 30) })
                }
              />
            </label>

            <label style={styles.label}>
              Reward minutes per pass ({settings.rewardMinutes})
              <input
                style={styles.input}
                type="number"
                min={5}
                max={60}
                value={settings.rewardMinutes}
                onChange={(e) => setSettings({ rewardMinutes: clampNum(e.target.value, 5, 60) })}
              />
            </label>

            <label style={styles.label}>
              Daily max minutes ({settings.dailyMaxMinutes})
              <input
                style={styles.input}
                type="number"
                min={10}
                max={240}
                value={settings.dailyMaxMinutes}
                onChange={(e) =>
                  setSettings({ dailyMaxMinutes: clampNum(e.target.value, 10, 240) })
                }
              />
            </label>

            <div style={styles.row}>
              <button style={styles.secondary} onClick={() => setMode("home")}>
                Back
              </button>
              <button style={styles.primary} onClick={startKidSession}>
                Start Kid Challenge
              </button>
            </div>
          </div>
        )}

        {mode === "kid" && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Multiplication Challenge</h2>

            {showResult && <div style={styles.alert}>{showResult}</div>}

            <div style={styles.progress}>
              Question <b>{idx + 1}</b> / {settings.questionsPerSession}
            </div>

            {questions[idx] && (
              <div style={styles.quizBox}>
                <div style={styles.problem}>
                  {questions[idx].a} × {questions[idx].b} =
                </div>
                <input
                  style={styles.bigInput}
                  inputMode="numeric"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAnswer();
                  }}
                  autoFocus
                />
                <button
                  style={styles.primary}
                  onClick={submitAnswer}
                  disabled={input.trim().length === 0}
                >
                  Submit
                </button>
              </div>
            )}

            <div style={styles.row}>
              <button style={styles.secondary} onClick={() => setMode("home")}>
                Exit
              </button>
            </div>
          </div>
        )}

        {mode === "play" && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Unlocked ✅</h2>
            <div style={styles.playTimer}>
              Play time remaining: <span style={styles.timer}>{mm}:{ss}</span>
            </div>

            <div style={styles.note}>
              For the MVP, this is where the kid would go play. In later versions, this timer can control
              real app access on mobile.
            </div>

            <div style={styles.row}>
              <button style={styles.secondary} onClick={() => setMode("home")}>
                End Session
              </button>
              <button
                style={styles.primary}
                onClick={() => startKidSession()}
                disabled={!canEarnMoreToday}
                title={!canEarnMoreToday ? "Daily max reached" : ""}
              >
                Earn More Time
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function clampNum(val: string, min: number, max: number) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0b1020",
    color: "white",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  card: {
    width: "100%",
    maxWidth: 720,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: 0.2 },
  subtitle: { opacity: 0.85, marginTop: 4 },
  badge: {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 14,
    whiteSpace: "nowrap",
  },
  section: { padding: 12 },
  h2: { fontSize: 20, margin: "4px 0 12px" },
  row: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
  label: { display: "block", marginBottom: 12, opacity: 0.95 },
  input: {
    display: "block",
    width: "100%",
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  },
  primary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "white",
    color: "#0b1020",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  note: {
    marginTop: 14,
    opacity: 0.85,
    fontSize: 14,
    lineHeight: 1.4,
  },
  alert: {
    background: "rgba(0, 255, 160, 0.10)",
    border: "1px solid rgba(0, 255, 160, 0.25)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  progress: { opacity: 0.9, marginBottom: 10 },
  quizBox: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  problem: { fontSize: 28, fontWeight: 900 },
  bigInput: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    fontSize: 22,
    outline: "none",
    width: "100%",
  },
  playTimer: { fontSize: 18, marginTop: 6 },
  timer: { fontSize: 28, fontWeight: 900 },
