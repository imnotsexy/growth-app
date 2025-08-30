"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Home, ClipboardList, MessageCircle, Settings, type LucideIcon, Bot,
  Circle,
  Ellipsis,
  Plus,
  Smile,
  Send,
  Mic,
  Camera,
  Paperclip, } from "lucide-react";


/** -----------------------------
 *  型定義（既存 + 拡張）
 *  ----------------------------*/
 type CategoryKey =
  | "運動"
  | "学習"
  | "習慣"
  | "信仰"
  | "人間力"
  | "金銭"
  | "睡眠"
  | "食事"
  | "メンタル";

type Quest = {
  id: string;
  title: string;
  done: boolean;
  enabled: boolean; // ON/OFF
  // --- 追加（表示強化用・任意） ---
  category?: string; // サブラベル表示
  points?: number;   // 行ごとのポイント表示
  progress?: number; // 0-100（長時間タスク）
  locked?: boolean;  // ロック表示
  note?: string;     // 小メモ
};

type DayPlan = {
  day: number; // 1..7
  quests: Quest[];
};

type Theme = {
  backgroundColor: string;
  textColor: string;
};

type AppState = {
  selectedCategories: CategoryKey[];
  plans: DayPlan[]; // 7日
  createdAt?: string; // ISO
  theme?: Theme; // テーマ設定
};

type ChatRole = "user" | "assistant";
type ChatMsg = { role: "assistant" | "user"; content: string };

/** -----------------------------
 *  ランク判定
 *  ----------------------------*/
type Rank = "入門者 (Novice)" | "従者 (Squire)" | "騎士 (Knight)" | "侯爵 (Marquis)" | "公爵 (Duke)" | "王者 (Sovereign)";

function calculateRank(score: number): Rank {
  if (score >= 1000) return "王者 (Sovereign)";
  if (score >= 500) return "公爵 (Duke)";
  if (score >= 200) return "侯爵 (Marquis)";
  if (score >= 100) return "騎士 (Knight)";
  if (score >= 50) return "従者 (Squire)";
  return "入門者 (Novice)";
}

/** -----------------------------
 *  定数
 *  ----------------------------*/
const ALL_CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "運動", label: "運動" },
  { key: "学習", label: "学習" },
  { key: "習慣", label: "習慣" },
  { key: "信仰", label: "信仰" },
  { key: "人間力", label: "社会性・人助け" },
  { key: "金銭", label: "金銭・資産形成" },
  { key: "睡眠", label: "睡眠" },
  { key: "食事", label: "食事" },
  { key: "メンタル", label: "メンタル" },
];

const TEMPLATE_QUESTS: Record<CategoryKey, string[]> = {
  運動: ["10分ストレッチ（首・肩・腰）", "軽いジョグ10分", "腕立て・腹筋・背筋 各10回"],
  学習: ["英単語15分", "読書20分", "講義ノートの復習10分"],
  習慣: ["デスク片付け5分", "洗濯物たたむ", "翌日のToDoを3つ書く"],
  信仰: ["日記3行（感謝）", "静かな祈り・瞑想5分", "善い行いを1つ"],
  人間力: ["誰かに挨拶＋一言", "家族/友人にLINEで近況", "ありがとうを3回伝える"],
  金銭: ["家計簿入力3分", "不要支出チェック", "投資/貯蓄を500円検討"],
  睡眠: ["就寝前のブルーライト10分カット", "就寝/起床時刻を記録", "水分を一杯飲む"],
  食事: ["水を1日1.5L目標", "サラダ/タンパク質を一品", "間食を一度スキップ"],
  メンタル: ["深呼吸3回", "3分瞑想", "散歩5分"],
};

const DEFAULT_THEME: Theme = {
  backgroundColor: "#ffffff",
  textColor: "#000000",
};

const STORAGE_KEY = "growth-planner-v1";
const POINTS_PER_QUEST = 10;

/** -----------------------------
 *  ユーティリティ
 *  ----------------------------*/
const uid = () => Math.random().toString(36).slice(2, 10);

function buildWeekPlan(selected: CategoryKey[]): DayPlan[] {
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) {
    const quests: Quest[] = [];
    selected.forEach((cat, idx) => {
      const candidates = TEMPLATE_QUESTS[cat];
      const base = (i + idx) % candidates.length;
      const titles = [candidates[base], candidates[(base + 1) % candidates.length]];
      titles.forEach((t, j) =>
        quests.push({
          id: uid(),
          title: t,
          done: false,
          enabled: true,
          category: cat,
          points: POINTS_PER_QUEST + (j === 1 ? 5 : 0), // 少し変化をつける
          progress: Math.random() < 0.3 ? Math.floor(Math.random() * 70) + 10 : undefined,
          locked: false,
        })
      );
    });
    const trimmed = quests.slice(0, 5);
    days.push({ day: i, quests: trimmed });
  }
return days;
}

function loadState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** -----------------------------
 *  画面コンポーネント
 *  ----------------------------*/
 type Tab = "ホーム" | "クエスト" | "チャット" | "設定";

export default function Page() {
  const [tab, setTab] = useState<Tab>("ホーム");
  const [state, setState] = useState<AppState | null>(null);
  const [selected, setSelected] = useState<CategoryKey[]>([]);

  // 初期ロード
  useEffect(() => {
    const s = loadState();
    if (s) {
      setState(s);
      if (!s.plans?.length && s.selectedCategories?.length) {
        setSelected(s.selectedCategories);
      }
    }
  }, []);

  const hasPlan = !!state?.plans?.length;

  const todayIndex = useMemo(() => {
    if (!state?.createdAt) return 0;
    const created = new Date(state.createdAt);
    const diffMs = new Date().getTime() - created.getTime();
    const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, day));
  }, [state?.createdAt]);

  const todayPlan = state?.plans?.[todayIndex];

  // スコアは全期間の完了クエスト×ポイントで概算
  const totalPoints = useMemo(() => {
    if (!state?.plans) return 0;
    const flat = state.plans.flatMap((p) => p.quests);
    const doneCnt = flat.filter((q) => q.enabled && q.done).length;
    return doneCnt * POINTS_PER_QUEST;
  }, [state?.plans]);

  const username = "勇者タクロウ"; // mock
  const currentRank = calculateRank(totalPoints);
  const rankOrder: Rank[] = [
    "入門者 (Novice)",
    "従者 (Squire)",
    "騎士 (Knight)",
    "侯爵 (Marquis)",
    "公爵 (Duke)",
    "王者 (Sovereign)",
  ];
  const nextRank = rankOrder[Math.min(rankOrder.indexOf(currentRank) + 1, rankOrder.length - 1)];
  const thresholdByRank: Record<Rank, number> = {
    "入門者 (Novice)": 0,
    "従者 (Squire)": 50,
    "騎士 (Knight)": 100,
    "侯爵 (Marquis)": 200,
    "公爵 (Duke)": 500,
    "王者 (Sovereign)": 1000,
  };
  const toNext = Math.max(thresholdByRank[nextRank] - totalPoints, 0);

  const weekDoneTotal = useMemo(() => state?.plans?.reduce((s, p) => s + p.quests.filter((q) => q.enabled && q.done).length, 0) ?? 0, [state?.plans]);
  const weekAllTotal = useMemo(() => state?.plans?.reduce((s, p) => s + p.quests.filter((q) => q.enabled).length, 0) ?? 0, [state?.plans]);
  const weekProgress = weekAllTotal ? Math.round((weekDoneTotal / weekAllTotal) * 100) : 0;

  const toggleDone = (dayIdx: number, qid: string) => {
    if (!state) return;
    const copy = structuredClone(state) as AppState;
    const day = copy.plans[dayIdx];
    const q = day.quests.find((x) => x.id === qid);
    if (!q || !q.enabled) return;
    q.done = !q.done;
    setState(copy);
    saveState(copy);
  };

  const toggleEnabled = (dayIdx: number, qid: string) => {
    if (!state) return;
    const copy = structuredClone(state) as AppState;
    const day = copy.plans[dayIdx];
    const q = day.quests.find((x) => x.id === qid);
    if (!q) return;
    q.enabled = !q.enabled;
    // 有効→無効にしたら完了フラグも落とす
    if (!q.enabled) q.done = false;
    setState(copy);
    saveState(copy);
  };

  const resetAll = () => {
    setState(null);
    setSelected([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  // まだプランがない → 旧ウィザードを表示
  if (!hasPlan) {
    const toggleCategory = (key: CategoryKey) => {
      setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const generate = () => {
      const base = selected.length ? selected : (["運動", "学習"] as CategoryKey[]);
      const plans = buildWeekPlan(base);
      const next: AppState = {
        selectedCategories: base as CategoryKey[],
        plans,
        createdAt: new Date().toISOString(),
      };
      setState(next);
      saveState(next);
    };

    return (
      <main className="mx-auto max-w-screen-sm p-4 text-black">
        <h1 className="text-xl font-semibold mb-4">どんな分野を伸ばしたい？</h1>
        <p className="text-sm text-neutral-600 mb-3">3つ前後選ぶのがおすすめ（後で変更できます）</p>
        <div className="grid grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`rounded-2xl border p-4 text-sm shadow-sm transition ${active ? "bg-rose-100 border-rose-300" : "bg-white border-neutral-200 hover:bg-neutral-50"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={generate} className="rounded-xl bg-rose-500 px-4 py-2 text-white shadow">7日間プランを作成</button>
          <button onClick={() => setSelected([])} className="text-sm text-neutral-600 underline underline-offset-4">選択をクリア</button>
        </div>
      </main>
    );
  }

  // 以降：新デザイン UI
  const todayEnabled = todayPlan?.quests.filter((q) => q.enabled) ?? [];
  const todayDone = todayEnabled.filter((q) => q.done);
  const doneCount = todayDone.length;
  const totalCount = todayEnabled.length;
  const todayEarned = doneCount * POINTS_PER_QUEST;
  const achievementRate = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      {/* CSS Variables for light/dark */}
      <style jsx global>{`
        :root { --background: #f7f7f7; --foreground: #111111; }
        .dark { --background: #0a0a0a; --foreground: #e5e5e5; }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 lg:px-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">River Agent</h1>
          <button
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="メニュー"
            onClick={() => setTab((t) => (t === "設定" ? "ホーム" : "設定"))}
          >
            <span className="i">≡</span> 
          </button>
          {/*右上ボタン */}
        </header>

        {tab === "ホーム" && (
          <>
            {/* Profile Card */}
            <section className="mb-6 rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-lg font-bold text-blue-700 dark:from-sky-900/40 dark:to-indigo-900/40 dark:text-sky-200">
                  🙂
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-neutral-500">{username}</p>
                    <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs text-white dark:bg-sky-600">
                      {currentRank}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">★ {totalPoints.toLocaleString()} ポイント</span>
                    <span className="text-neutral-500">次ランクまで {toNext.toLocaleString()} pt</span>
                  </div>

                  {/* Week progress bar */}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-neutral-900 transition-all dark:bg-sky-500" style={{ width: `${weekProgress}%` }} />
                  </div>

                  {/* Week days */}
                  <div className="mt-3 flex items-center gap-3 overflow-x-auto">
                    {["月", "火", "水", "木", "金", "土", "日"].map((d, i) => {
                      const state = i < todayIndex ? "done" : i === todayIndex ? "active" : "future";
                      return (
                        <div key={d} className="flex items-center gap-2">
                          <div
                            className={[
                              "grid h-7 w-7 place-items-center rounded-full text-xs",
                              state === "done" && "bg-neutral-900 text-white dark:bg-sky-500",
                              state === "active" && "border-2 border-neutral-900 text-neutral-900 dark:border-sky-400 dark:text-sky-200",
                              state === "future" && "bg-neutral-100 text-neutral-400 dark:bg-white/10",
                            ].filter(Boolean).join(" ")}
                          >
                            {i + 1}
                          </div>
                          <span className="text-xs text-neutral-500">{d}</span>
                        </div>
                      );
                    })}
                    <div className="grow" />
                    <button
                      className="ms-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => setTab("クエスト")}
                    >
                      + 追加
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Today's Quests */}
            <section className="space-y-3">
              <h2 className="sr-only">今日のクエスト</h2>
              {todayEnabled.map((q) => (
                <article key={q.id} className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-3">
                    <label className="mt-0.5 inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:text-sky-500"
                        checked={q.done}
                        onChange={() => toggleDone(todayIndex, q.id)}
                      />
                    </label>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium leading-tight">{q.title}</p>
                          <p className="text-xs text-neutral-500">Day {todayIndex + 1}</p>
                        </div>
                        <div className="whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-white dark:bg-sky-600">
                            +{POINTS_PER_QUEST}ポイント
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-neutral-500">{q.done ? "完了済み" : "未開始"}</div>
                    </div>
                  </div>
                </article>
              ))}
              {todayEnabled.length === 0 && (
                <div className="rounded-2xl border bg-white/60 p-4 text-sm text-neutral-500">今日は有効なクエストがありません</div>
              )}
            </section>

            {/* Today summary */}
            <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-2xl font-semibold">{doneCount}/{totalCount}</div>
                <div className="mt-1 text-xs text-neutral-500">完了クエスト</div>
              </div>
              <div className="rounded-2xl border bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-2xl font-semibold">{todayEarned}</div>
                <div className="mt-1 text-xs text-neutral-500">獲得ポイント</div>
              </div>
              <div className="rounded-2xl border bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-2xl font-semibold">{achievementRate}%</div>
                <div className="mt-1 text-xs text-neutral-500">達成率</div>
              </div>
            </section>
          </>
        )}

        {tab === "クエスト" && state && (
          <QuestView
            plans={state.plans}
            todayIndex={todayIndex}
            onToggleDone={toggleDone}
            onToggleEnabled={toggleEnabled}
          />
        )}

        {tab === "チャット" && <ChatView />}

        {tab === "設定" && (
          <SettingsView
            onReset={resetAll}
            theme={state.theme ?? DEFAULT_THEME}
            onThemeChange={(theme) => {
              setState((prev) => (prev ? { ...prev, theme } : null));
              if (state) saveState({ ...state, theme });
            }}
          />
        )}
      </div>

      {/* 下のボタン4つ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-900/70">
        <ul className="mx-auto grid max-w-4xl grid-cols-4 px-4 py-2 text-xs">
          {([
            { label: "ホーム", icon: Home },
            { label: "クエスト", icon: ClipboardList },
            { label: "チャット", icon: MessageCircle },
            { label: "設定", icon: Settings },
          ] as const).map((item) => (
            <li key={item.label} className="flex items-center justify-center">
              <button
                className={[
                  "flex min-w-[4.5rem] flex-col items-center rounded-xl px-3 py-1.5",
                  tab === item.label
                    ? "bg-neutral-900 text-white dark:bg-sky-600"
                    : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10",
                ].join(" ")}
                onClick={() => setTab(item.label as Tab)}
              >
                {/* ←ここを修正 */}
                <item.icon className="h-5 w-5 mb-1" strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

/** -----------------------------
 *  既存ビュー：クエスト
 *  ----------------------------*/
function QuestView({
  plans,
  todayIndex,
  onToggleDone,
  onToggleEnabled,
}: {
  plans: DayPlan[];
  todayIndex: number;
  onToggleDone: (dayIdx: number, qid: string) => void;
  onToggleEnabled: (dayIdx: number, qid: string) => void;
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">クエスト</h1>

      <div className="space-y-4">
        {plans.map((p, idx) => {
          const isToday = idx === todayIndex;
          const dayEnabled = p.quests.some((q) => q.enabled);

          const toggleDay = (checked: boolean) => {
            // Day単位でON/OFF（全クエストの enabled を切り替え）
            p.quests.forEach((q) => {
              q.enabled = checked;
              if (!checked) q.done = false;
            });
          };

          return (
            <div
              key={p.day}
              className={[
                "rounded-2xl border bg-white p-4 shadow-sm",
                isToday ? "border-rose-300 ring-2 ring-rose-100" : "border-neutral-200",
              ].join(" ")}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-700">{p.day}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">Day {p.day}</div>
                      {isToday && (
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">TODAY</span>
                      )}
                    </div>
                    {/* サブタイトルがあればここに表示（例：実践練習・今日） */}
                    {isToday && (
                      <div className="text-xs text-rose-500">実践練習・今日</div>
                    )}
                  </div>
                </div>

                {/* Dayスイッチ */}
                <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                  <span className="text-xs text-neutral-500 hidden sm:inline">有効</span>
                  <input
                    type="checkbox"
                    defaultChecked={dayEnabled}
                    onChange={(e) => toggleDay(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-neutral-200 transition peer-checked:bg-emerald-500">
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </span>
                </label>
              </div>

              {/* Quests list */}
              <ul className="space-y-3">
                {p.quests.map((q) => (
                  <li key={q.id} className="rounded-xl border border-neutral-100 bg-white/80 p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      {/* checkbox */}
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 rounded border-neutral-300 text-violet-600 focus:ring-violet-600 disabled:opacity-40"
                        checked={q.done}
                        disabled={!q.enabled || q.locked}
                        onChange={() => onToggleDone(idx, q.id)}
                      />

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={["font-medium", q.done ? "line-through text-neutral-400" : ""].filter(Boolean).join(" ")}>{q.title}</p>
                            {/* サブ情報 */}
                            {(q.category || q.note) && (
                              <p className="text-xs text-neutral-500">{q.category}{q.note ? ` ・ ${q.note}` : ""}</p>
                            )}
                          </div>

                          {/* ポイントバッジ */}
                          <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                            +{(q.points ?? POINTS_PER_QUEST)}pt
                          </span>
                        </div>

                        {/* 進捗バー or ステータス */}
                        {typeof q.progress === "number" && !q.done && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${q.progress}%` }} />
                            </div>
                            <span className="text-xs text-neutral-500">{q.progress}%</span>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-3 text-xs">
                          {q.done && (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                              完了済み
                            </span>
                          )}
                          {!q.enabled && (
                            <span className="inline-flex items-center gap-1 text-neutral-400">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17a2 2 0 0 0 2-2V7a2 2 0 0 0-4 0v8a2 2 0 0 0 2 2z"/><path d="M5 11h14v10H5z"/></svg>
                              ロック中
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 個別ON/OFF */}
                      <button
                        onClick={() => onToggleEnabled(idx, q.id)}
                        className={["rounded-full border px-2 py-1 text-xs",
                          q.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-100 text-neutral-500"
                        ].join(" ")}
                        title="ON/OFF"
                      >
                        {q.enabled ? "ON" : "OFF"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Bonus banner（今日のみ）*/}
              {isToday && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <div className="flex items-center gap-2 font-medium">
                    <span>🔥 今日のボーナス</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-rose-600">+50pt</span>
                  </div>
                  <p className="mt-1 text-rose-600/90">すべてのクエストを完了すると追加ポイントを獲得！</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}


/** -----------------------------
 *  NEW: チャット（模擬）<-バックエンド連携
 *  ----------------------------*/
/* ---------- NEW ChatView (replace here) ---------- */
function ChatView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "River Agentです！ 何でもお聞きください 🤖" },
    { role: "assistant", content: "こんにちは！今日はどのようなことでお手伝いできますか？" },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const userMsg: ChatMsg = { role: "user", content: t };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const reply = mockAssistant(t, messages);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setIsTyping(false);
    }, Math.min(1200, Math.max(300, reply.length * 25)));
  };

  const resetChat = () => {
    setMessages([{ role: "assistant", content: "新しいチャットを始めよう。目標は？" }]);
  };

  // 送受信のたびに最下部へ
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <section className="my-2 space-y-3">
      {/* Header */}
      <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <span className="absolute -right-0.5 -bottom-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white">
              <Circle className="h-2.5 w-2.5 fill-green-500 stroke-green-500" />
            </span>
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold leading-5">River Agent</div>
            <div className="text-xs text-neutral-500">オンライン</div>
          </div>
          <button className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100" aria-label="メニュー">
            <Ellipsis className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-80 space-y-3 overflow-y-auto rounded-2xl border bg-white p-4 shadow-sm">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <BotBubble key={i}>{m.content}</BotBubble>
          ) : (
            <UserBubble key={i}>{m.content}</UserBubble>
          )
        )}

        {isTyping && (
          <div className="flex items-end gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl bg-neutral-100 px-3 py-2 text-sm shadow">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce [animation-delay:150ms]">•</span>
                <span className="animate-bounce [animation-delay:300ms]">•</span>
              </span>
            </div>
          </div>
        )}

        {/* アンカー */}
        <div ref={scrollRef} />

        {/* サジェスト（タイピング時は非表示） */}
        {!isTyping && (
          <div className="mt-2 flex flex-wrap gap-2">
            <SuggestChip onClick={() => handleSubmit("アイデア提案が欲しい")}>アイデア提案</SuggestChip>
            <SuggestChip onClick={() => handleSubmit("データ分析をお願い")}>データ分析</SuggestChip>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSubmit={handleSubmit} />

      <div className="flex justify-end">
        <button onClick={resetChat} className="text-xs text-neutral-600 underline underline-offset-4">
          チャットをリセット
        </button>
      </div>
    </section>
  );
}

/* ---------- Sub Components ---------- */
function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm shadow ring-1 ring-black/5">
        {children}
        <div className="mt-1 text-[10px] text-neutral-400">14:23</div>
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="max-w-[85%] rounded-2xl bg-blue-600 px-3 py-2 text-sm text-white shadow">
        {children}
        <div className="mt-1 text-right text-[10px] text-blue-100/90">14:24</div>
      </div>
      <div className="mt-0.5 h-8 w-8 rounded-full bg-neutral-300" />
    </div>
  );
}

function SuggestChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full border px-3 py-1 text-sm shadow-sm transition hover:bg-neutral-50">
      {children}
    </button>
  );
}

function ChatInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  };

  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100" aria-label="追加">
          <Plus className="h-5 w-5" />
        </button>

        <input
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/40"
          placeholder="メッセージを入力…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        <button className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100" aria-label="絵文字">
          <Smile className="h-5 w-5" />
        </button>

        <button onClick={send} className="rounded-full bg-blue-600 p-2 text-white shadow hover:bg-blue-600/90" aria-label="送信">
          <Send className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <AttachmentChip icon={<Mic className="h-4 w-4" />}>音声入力</AttachmentChip>
        <AttachmentChip icon={<Camera className="h-4 w-4" />}>写真</AttachmentChip>
        <AttachmentChip icon={<Paperclip className="h-4 w-4" />}>ファイル</AttachmentChip>
      </div>
    </div>
  );
}

function AttachmentChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-3 py-1 ring-1 ring-neutral-200 hover:bg-neutral-100">
      {icon}
      <span>{children}</span>
    </button>
  );
}



//言葉を適当に返すだけの簡易版 //バックエンド
// ダミー応答（既存のmockAssistantがあれば差し替え）
function mockAssistant(input: string, _messages: ChatMsg[]): string {
  if (/進捗|status|ステータス/.test(input)) return "現在の進捗を要約します。まずはタスク一覧を共有してください。";
  if (/データ|分析/.test(input)) return "CSVかスプレッドシートをアップロードいただければ、概要統計→可視化→所見まで出します。";
  return "承知しました。もう少し具体的に状況を教えてください。";
}

/** -----------------------------
 *  補助 UI
 *  ----------------------------*/
function SettingsView({ onReset, theme, onThemeChange }: { onReset: () => void; theme: Theme; onThemeChange: (theme: Theme) => void }) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">設定</h1>
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm text-neutral-600">進行中のクエストをリセットして最初から始めます。</div>
        <button onClick={onReset} className="rounded-xl bg-neutral-900 px-4 py-2 text-white">すべてをリセット</button>
      </div>
    </section>
  );
}

function MessageInput({ onSubmit }: { onSubmit: (message: string) => void }) {
  const [input, setInput] = useState("");
  const handleSend = () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
  };
  return (
    <div className="flex items-center space-x-2 my-4">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="メッセージを入力..."
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
      />
      <button onClick={handleSend} className="rounded-lg bg-rose-500 px-4 py-2 text-white">送信</button>
    </div>
  );
}

