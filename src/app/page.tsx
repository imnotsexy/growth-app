// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/** -----------------------------
 *  型定義
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
};

type DayPlan = {
  day: number; // 1..7
  quests: Quest[];
};

type AppState = {
  selectedCategories: CategoryKey[];
  plans: DayPlan[]; // 7日
  createdAt?: string; // ISO
  theme?: Theme; // テーマ設定
};

type Theme = {
  backgroundColor: string;
  textColor: string;
};



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
  backgroundColor: "#ffffff", // 白
  textColor: "#000000", // 黒
};

const STORAGE_KEY = "growth-planner-v1";

/** -----------------------------
 *  ユーティリティ
 *  ----------------------------*/
const uid = () => Math.random().toString(36).slice(2, 10);

function buildWeekPlan(selected: CategoryKey[]): DayPlan[] {
  // 7日×(カテゴリ数に応じて3〜5個ほど)を生成
  const days: DayPlan[] = [];
  for (let i = 1; i <= 7; i++) {
    const quests: Quest[] = [];

    selected.forEach((cat, idx) => {
      const candidates = TEMPLATE_QUESTS[cat];
      // 日替わりで回転させる
      const base = (i + idx) % candidates.length;
      const titles = [
        candidates[base],
        candidates[(base + 1) % candidates.length],
      ];
      titles.forEach((t) =>
        quests.push({ id: uid(), title: `${t}`, done: false, enabled: true })
      );
    });

    // 多すぎると大変なので最大5件に丸める
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
type Tab = "ホーム" | "クエスト" | "設定";

export default function Page() {
  const [tab, setTab] = useState<Tab>("ホーム");
  const [state, setState] = useState<AppState | null>(null);
  const [selected, setSelected] = useState<CategoryKey[]>([]); // ← トップレベルへ移動
  const hasPlan = !!state?.plans?.length;

  useEffect(() => {
    const s = loadState();
    if (s) {
      setState(s);
      // プラン未作成なら、保存済みの選択カテゴリを初期値に反映（任意）
      if (!s.plans?.length && s.selectedCategories?.length) {
        setSelected(s.selectedCategories);
      }
    }
  }, []);

  // 今日のDay番号（0..6）
  const todayIndex = useMemo(() => {
    if (!state?.createdAt) return 0;
    const created = new Date(state.createdAt);
    const diffMs = new Date().getTime() - created.getTime();
    const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, day));
  }, [state?.createdAt]);

  const todayPlan = state?.plans?.[todayIndex];

  const toggleDone = (dayIdx: number, qid: string) => {
    if (!state) return;
    const copy = structuredClone(state) as AppState;
    const day = copy.plans[dayIdx];
    const q = day.quests.find((x) => x.id === qid);
    if (!q) return;
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
    setState(copy);
    saveState(copy);
  };

  const resetAll = () => {
    setState(null);
    setSelected([]); // 選択もクリア
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  /** 初期カテゴリ選択ステップ */
  if (!hasPlan) {
    const toggleCategory = (key: CategoryKey) => {
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
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
      setTab("クエスト");
    };

    return (
      <main className="mx-auto max-w-screen-sm p-4">
        <h1 className="text-xl font-semibold mb-4">どんな分野を伸ばしたい？</h1>
        <p className="text-sm text-neutral-600 mb-3">
          3つ前後選ぶのがおすすめ（後で変更できます）
        </p>
        <div className="grid grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`rounded-2xl border p-4 text-sm shadow-sm transition
                  ${active ? "bg-rose-100 border-rose-300" : "bg-white border-neutral-200 hover:bg-neutral-50"}
                `}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={generate}
            className="rounded-xl bg-rose-500 px-4 py-2 text-white shadow"
          >
            7日間スタータープランを作成
          </button>
          <button
            onClick={() => setSelected([])}
            className="text-sm text-neutral-600 underline underline-offset-4"
          >
            選択をクリア
          </button>
        </div>

        <FooterNav current={tab} onChange={setTab} disabled />
      </main>
    );
  }

  /** 通常画面（ホーム/クエスト/設定） */
  return (
    <main className="mx-auto max-w-screen-sm p-4">
      {tab === "ホーム" && todayPlan && (
        <HomeView
          todayPlan={todayPlan}
          onRandom={() => setTab("クエスト")}
        />
      )}

      {tab === "クエスト" && state && (
        <QuestView
          plans={state.plans}
          todayIndex={todayIndex}
          onToggleDone={toggleDone}
          onToggleEnabled={toggleEnabled}
        />
      )}

      {tab === "設定" && (
        <SettingsView
          onReset={resetAll}
          theme={state.theme ?? DEFAULT_THEME}
          onThemeChange={(theme) => {
            setState((prev) => (prev ? { ...prev, theme } : null));
            saveState({ ...state, theme });
          }}
        />
      )}

      <FooterNav current={tab} onChange={setTab} />
    </main>
  );
}

/** -----------------------------
 *  ビュー：ホーム
 *  ----------------------------*/
function HomeView({
  todayPlan,
  onRandom,
}: {
  todayPlan: DayPlan;
  onRandom: () => void;
}) {
  const enabled = todayPlan.quests.filter((q) => q.enabled);
  const doneCount = enabled.filter((q) => q.done).length;

  const randomQuest = useMemo(() => {
    if (!enabled.length) return null;
    return enabled[Math.floor(Math.random() * enabled.length)];
  }, [todayPlan]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">ホーム（ダッシュボード）</h1>
      <div className="rounded-2xl bg-white p-4 shadow-sm border">
        <div className="text-sm text-neutral-500 mb-2">今日の目標達成度</div>
        <div className="text-3xl font-bold">{doneCount} / {enabled.length}</div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm border">
        <div className="text-sm text-neutral-500 mb-2">ランダムクエスト</div>
        {randomQuest ? (
          <div className="flex items-center justify-between">
            <div className="font-medium">{randomQuest.title}</div>
            <button
              onClick={onRandom}
              className="rounded-xl bg-rose-500 px-3 py-1.5 text-white"
            >
              やってみる
            </button>
          </div>
        ) : (
          <div className="text-neutral-500">有効なクエストがありません</div>
        )}
      </div>
    </section>
  );
}

/** -----------------------------
 *  ビュー：クエスト
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p, idx) => (
          <div
            key={p.day}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              idx === todayIndex ? "border-rose-400" : "border-neutral-200"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Day {p.day}</div>
              {idx === todayIndex && (
                <span className="text-xs text-rose-600">今日</span>
              )}
            </div>
            <ul className="space-y-2">
              {p.quests.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={q.done}
                      disabled={!q.enabled}
                      onChange={() => onToggleDone(idx, q.id)}
                      className="h-4 w-4"
                    />
                    <span className={q.enabled ? "" : "line-through text-neutral-400"}>
                      {q.title}
                    </span>
                  </label>
                  {/* ON/OFF */}
                  <button
                    onClick={() => onToggleEnabled(idx, q.id)}
                    className={`rounded-lg px-2 py-1 text-xs border ${
                      q.enabled
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-neutral-100 border-neutral-200"
                    }`}
                    title="ON/OFF"
                  >
                    {q.enabled ? "ON" : "OFF"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** -----------------------------
 *  ビュー：設定
 *  ----------------------------*/
function SettingsView({ onReset, theme, onThemeChange }: { onReset: () => void, theme: Theme, onThemeChange: (theme: Theme) => void }) {
  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ ...theme, backgroundColor: e.target.value });
  };

  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ ...theme, textColor: e.target.value });
  };

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">設定</h1>
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm text-neutral-600">
          データを初期化して最初からやり直します
        </div>
        <button
          onClick={onReset}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-white"
        >
          すべてリセット
        </button>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">テーマ設定</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium">背景色</label>
            <input
              type="color"
              value={theme.backgroundColor}
              onChange={handleBackgroundColorChange}
              className="w-full h-10 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">文字色</label>
            <input
              type="color"
              value={theme.textColor}
              onChange={handleTextColorChange}
              className="w-full h-10 border rounded"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** -----------------------------
 *  フッターナビ（ホーム / クエスト / 設定）
 *  ----------------------------*/
function FooterNav({
  current,
  onChange,
  disabled = false,
}: {
  current: Tab;
  onChange: (t: Tab) => void;
  disabled?: boolean;
}) {
  const items: Tab[] = ["ホーム", "クエスト", "設定"];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-screen-sm border-t bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around">
        {items.map((t) => {
          const active = current === t;
          return (
            <li key={t} className="flex-1">
              <button
                disabled={disabled}
                onClick={() => onChange(t)}
                className={`w-full py-3 text-sm transition ${
                  active ? "text-rose-600 font-medium" : "text-neutral-600"
                } ${disabled ? "opacity-50" : ""}`}
              >
                {t}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
