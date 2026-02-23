"use client";

import React, { useEffect, useMemo, useState } from "react";

type Mode = "home" | "parent" | "quiz" | "unlock";

type Settings = {
  passingPct: number;
  questionsPerSession: number;
  rewardMinutes: number;
};

type Q = { a: number; b: number; answer: number };

const DEFAULTS: Settings = { passingPct: 80, questionsPerSession: 10, rewardMinutes: 10 };

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeQuestions(n: number): Q[] {
  return Array.from({ length: n }).map(() => {
    const a = Math.random() < 0.65 ? randInt(6, 12) : randInt(0, 12);
    const b = Math.random() < 0.65 ? randInt(6, 12) : randInt(0, 12);
    return { a, b, answer: a * b };
  });
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // quiz state
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // unlock timer (in-app MVP)
  const [secondsLeft, setSecondsLeft] = useState(0);

  const progress = useMemo(() => {
    const total = Math.max(1, settings.questionsPerSession);
    return Math.round(((i + 1) / total) * 100);
  }, [i, settings.questionsPerSession]);

  const scorePct = useMemo(() => {
    const total = Math.max(1, settings.questionsPerSession);
    return Math.round((correct / total) * 100);
  }, [correct, settings.questionsPerSession]);

  function startQuiz() {
    setFeedback(null);
    setCorrect(0);
    setI(0);
    setVal("");
    setQs(makeQuestions(settings.questionsPerSession));
    setMode("quiz");
  }

  function submit() {
    const cur = qs[i];
    const ans = Number(val.trim());
    const isCorrect = Number.isFinite(ans) && ans === cur.answer;

    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextIndex = i + 1;

    if (nextIndex >= qs.length) {
      const pct = Math.round((nextCorrect / settings.questionsPerSession) * 100);
      if (pct >= settings.passingPct) {
        setSecondsLeft(settings.rewardMinutes * 60);
        setMode("unlock");
        setFeedback(null);
      } else {
        setFeedback(`You scored ${pct}%. You need ${settings.passingPct}% to unlock. Try a new set.`);
        // reset with a new set immediately
        setCorrect(0);
        setI(0);
        setVal("");
        setQs(makeQuestions(settings.questionsPerSession));
      }
      return;
    }

    setCorrect(nextCorrect);
    setI(nextIndex);
    setVal("");
  }

  // timer tick
  useEffect(() => {
    if (mode !== "unlock") return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode, secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <header style={S.header}>
          <div>
            <div style={S.brand}>LevelED Up</div>
            <div style={S.tag}>Earn play time by leveling up your skills.</div>
          </div>
          <div style={S.pill}>{modeLabel(mode)}</div>
        </header>

        {mode === "home" && (
          <section style={S.card}>
            <h2 style={S.h2}>Welcome</h2>
            <p style={S.p}>Choose Parent Settings or start a Kid Challenge.</p>

            <div style={S.row}>
              <button style={S.primary} onClick={() => setMode("parent")}>Parent Settings</button>
              <button style={S.secondary} onClick={startQuiz}>Kid: Start Challenge</button>
            </div>

            <div style={S.note}>
              MVP note: this version “unlocks” an in-app play timer. Later we can add real app/device controls.
            </div>
          </section>
        )}

        {mode === "parent" && (
          <section style={S.card}>
            <h2 style={S.h2}>Parent Settings</h2>

            <div style={S.grid}>
              <label style={S.label}>
                Passing %
                <input
                  style={S.input}
                  type="number"
                  min={50}
                  max={100}
                  value={settings.passingPct}
                  onChange={(e) => setSettings({ ...settings, passingPct: clamp(e.target.value, 50, 100) })}
                />
              </label>

              <label style={S.label}>
                Questions per session
                <input
                  style={S.input}
                  type="number"
                  min={5}
                  max={30}
                  value={settings.questionsPerSession}
                  onChange={(e) => setSettings({ ...settings, questionsPerSession: clamp(e.target.value, 5, 30) })}
                />
              </label>

              <label style={S.label}>
                Reward minutes
                <input
                  style={S.input}
                  type="number"
                  min={1}
                  max={60}
                  value={settings.rewardMinutes}
                  onChange={(e) => setSettings({ ...settings, rewardMinutes: clamp(e.target.value, 1, 60) })}
                />
              </label>
            </div>

            <div style={S.row}>
              <button style={S.secondary} onClick={() => setMode("home")}>Back</button>
              <button style={S.primary} onClick={startQuiz}>Start Challenge</button>
            </div>
          </section>
        )}

        {mode === "quiz" && (
          <section style={S.card}>
            <div style={S.topRow}>
              <h2 style={S.h2}>Multiplication Challenge</h2>
              <button style={S.link} onClick={() => setMode("home")}>Exit</button>
            </div>

            <div style={S.barOuter} aria-label="Progress">
              <div style={{ ...S.barInner, width: `${progress}%` }} />
            </div>

            <div style={S.meta}>
              <span>Question <b>{i + 1}</b> / {settings.questionsPerSession}</span>
              <span>Score: <b>{scorePct}%</b></span>
            </div>

            {feedback && <div style={S.alert}>{feedback}</div>}

            <div style={S.problemBox}>
              <div style={S.problem}>
                {qs[i]?.a} × {qs[i]?.b} =
              </div>

              <input
                style={S.bigInput}
                inputMode="numeric"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && val.trim() && submit()}
                autoFocus
                placeholder="Type answer"
              />

              <button style={S.primary} onClick={submit} disabled={!val.trim()}>
                Submit
              </button>
            </div>
          </section>
        )}

        {mode === "unlock" && (
          <section style={S.card}>
            <h2 style={S.h2}>Unlocked ✅</h2>
            <p style={S.p}>Play time remaining</p>

            <div style={S.timer}>{mm}:{ss}</div>

            <div style={S.row}>
              <button style={S.secondary} onClick={() => setMode("home")}>End Session</button>
              <button style={S.primary} onClick={startQuiz}>Earn More</button>
            </div>
          </section>
        )}

        <footer style={S.footer}>
          <span style={{ opacity: 0.75 }}>v0.1 • Design pass</span>
        </footer>
      </div>
    </div>
  );
}

function clamp(v: string, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function modeLabel(m: Mode) {
  if (m === "home") return "Home";
  if (m === "parent") return "Parent";
  if (m === "quiz") return "Kid Challenge";
  return "Unlocked";
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    color: "white",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  shell: { width: "100%", maxWidth: 760 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  brand: { fontSize: 30, fontWeight: 900, letterSpacing: 0.2 },
  tag: { opacity: 0.8, marginTop: 4 },
  pill: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  h2: { margin: 0, fontSize: 20, fontWeight: 800 },
  p: { marginTop: 10, opacity: 0.88, lineHeight: 1.45 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 },
  primary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "white",
    color: "#0b1020",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  link: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontWeight: 700,
  },
  note: { marginTop: 14, fontSize: 13, opacity: 0.75, lineHeight: 1.4 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 },
  label: { display: "grid", gap: 6, fontSize: 13, opacity: 0.95 },
  input: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  barOuter: {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: 14,
  },
  barInner: { height: "100%", borderRadius: 999, background: "rgba(255,255,255,0.85)" },
  meta: { display: "flex", justifyContent: "space-between", marginTop: 10, opacity: 0.85, fontSize: 13 },
  alert: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255, 90, 90, 0.35)",
    background: "rgba(255, 90, 90, 0.12)",
  },
  problemBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
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
    fontSize: 20,
    outline: "none",
    width: "100%",
  },
  timer: { fontSize: 42, fontWeight: 950, letterSpacing: 1, marginTop: 6 },
  footer: { marginTop: 10, textAlign: "center", fontSize: 12 },
};